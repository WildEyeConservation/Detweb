import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/reconcilePretileLaunches';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { GraphQLResult } from '@aws-amplify/api-graphql';
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import pLimit from 'p-limit';

Amplify.configure(
  {
    API: {
      GraphQL: {
        endpoint: env.AMPLIFY_DATA_GRAPHQL_ENDPOINT,
        region: env.AWS_REGION,
        defaultAuthMode: 'iam',
      },
    },
  },
  {
    Auth: {
      credentialsProvider: {
        getCredentialsAndIdentityId: async () => ({
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            sessionToken: env.AWS_SESSION_TOKEN,
          },
        }),
        clearCredentialsAndIdentityId: () => {
          /* noop */
        },
      },
    },
  }
);

const client = generateClient({ authMode: 'iam' });

const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    sessionToken: env.AWS_SESSION_TOKEN,
  },
});

// ── GraphQL ──

const listProjectsQuery = /* GraphQL */ `
  query ListProjects($nextToken: String) {
    listProjects(limit: 500, nextToken: $nextToken) {
      items {
        id
        status
        pretileManifestS3Key
      }
      nextToken
    }
  }
`;

const getImageTiledAtQuery = /* GraphQL */ `
  query GetImage($id: ID!) {
    getImage(id: $id) {
      id
      tiledAt
    }
  }
`;

const updateProjectMutation = /* GraphQL */ `
  mutation UpdateProject($input: UpdateProjectInput!) {
    updateProject(input: $input) {
      id
      group
    }
  }
`;

const updateProjectMembershipsMutation = /* GraphQL */ `
  mutation UpdateProjectMemberships($projectId: String!) {
    updateProjectMemberships(projectId: $projectId)
  }
`;

// ── Types ──

type ProjectRow = {
  id: string;
  status: string | null;
  pretileManifestS3Key: string | null;
};

type PretileManifest = {
  launchId: string;
  projectId: string;
  annotationSetId: string | null;
  workflow: string;
  imageIds: string[];
  createdAt: string;
};

// ── Helpers ──

async function executeGraphql<T>(
  query: string,
  variables: Record<string, any>
): Promise<T> {
  const resp = (await client.graphql({ query, variables } as any)) as GraphQLResult<T>;
  if (resp.errors && resp.errors.length > 0) {
    throw new Error(
      `GraphQL error: ${JSON.stringify(resp.errors.map((e) => e.message))}`
    );
  }
  if (!resp.data) throw new Error('GraphQL response missing data');
  return resp.data;
}

type ListProjectsResult = {
  listProjects: { items: ProjectRow[]; nextToken?: string | null };
};

async function listInflightProjects(): Promise<ProjectRow[]> {
  // Filter client-side after listing. listProjects filter inputs don't support
  // `attributeExists` reliably in Amplify Gen 2, and the project table is small
  // enough to scan.
  const all: ProjectRow[] = [];
  let nextToken: string | null = null;
  do {
    const data: ListProjectsResult = await executeGraphql<ListProjectsResult>(
      listProjectsQuery,
      { nextToken }
    );
    all.push(...data.listProjects.items);
    nextToken = data.listProjects.nextToken ?? null;
  } while (nextToken);
  return all.filter((p) => !!p.pretileManifestS3Key);
}

async function loadManifest(key: string): Promise<PretileManifest | null> {
  try {
    const resp = await s3.send(
      new GetObjectCommand({ Bucket: env.OUTPUTS_BUCKET_NAME, Key: key })
    );
    const body = await resp.Body?.transformToString();
    if (!body) return null;
    return JSON.parse(body) as PretileManifest;
  } catch (err: any) {
    const status = err?.$metadata?.httpStatusCode;
    if (status === 404 || err?.name === 'NoSuchKey') return null;
    throw err;
  }
}

async function allImagesTiled(
  imageIds: string[],
  manifestCreatedAt: string
): Promise<boolean> {
  if (imageIds.length === 0) return true;
  // An image counts as "done for this launch" only if its tiledAt is AFTER
  // the launch manifest was created. Otherwise a refresh-only launch (where
  // every image already had a stale tiledAt set from a previous launch)
  // would appear complete the instant the manifest was written, before the
  // refresh workers actually touched the S3 tiles.
  const createdAtMs = Date.parse(manifestCreatedAt);
  const limit = pLimit(20);
  let firstUntiled: string | null = null;
  await Promise.all(
    imageIds.map((id) =>
      limit(async () => {
        if (firstUntiled) return;
        const data = await executeGraphql<{
          getImage?: { tiledAt: string | null } | null;
        }>(getImageTiledAtQuery, { id });
        if (!data.getImage) {
          firstUntiled = id;
          return;
        }
        const tiledAt = data.getImage.tiledAt;
        if (!tiledAt) {
          firstUntiled = id;
          return;
        }
        const tiledAtMs = Date.parse(tiledAt);
        if (!Number.isFinite(tiledAtMs) || tiledAtMs < createdAtMs) {
          firstUntiled = id;
        }
      })
    )
  );
  return firstUntiled === null;
}

async function completeLaunch(project: ProjectRow, manifestKey: string) {
  await executeGraphql(updateProjectMutation, {
    input: {
      id: project.id,
      status: 'active',
      pretileManifestS3Key: null,
    },
  });
  try {
    await executeGraphql(updateProjectMembershipsMutation, {
      projectId: project.id,
    });
  } catch (err) {
    console.warn('updateProjectMemberships failed', err);
  }
  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: env.OUTPUTS_BUCKET_NAME,
        Key: manifestKey,
      })
    );
  } catch (err) {
    console.warn('manifest delete failed', err);
  }
}

// ── Handler ──

export const handler: Handler = async () => {
  const startedAt = Date.now();
  const projects = await listInflightProjects();
  console.log(
    JSON.stringify({
      msg: 'reconcile_start',
      inflightCount: projects.length,
    })
  );

  const projectLimit = pLimit(5);
  const results = await Promise.all(
    projects.map((project) =>
      projectLimit(async () => {
        if (!project.pretileManifestS3Key) {
          return { project: project.id, action: 'no-key' };
        }
        const manifest = await loadManifest(project.pretileManifestS3Key);
        if (!manifest) {
          console.warn('manifest missing, clearing pointer', {
            projectId: project.id,
            key: project.pretileManifestS3Key,
          });
          await executeGraphql(updateProjectMutation, {
            input: {
              id: project.id,
              status: 'active',
              pretileManifestS3Key: null,
            },
          });
          return { project: project.id, action: 'manifest-missing' };
        }

        const done = await allImagesTiled(manifest.imageIds, manifest.createdAt);
        if (done) {
          await completeLaunch(project, project.pretileManifestS3Key);
          return {
            project: project.id,
            action: 'completed',
            imageCount: manifest.imageIds.length,
          };
        }

        return {
          project: project.id,
          action: 'still-waiting',
          imageCount: manifest.imageIds.length,
        };
      })
    )
  );

  console.log(
    JSON.stringify({
      msg: 'reconcile_done',
      elapsedMs: Date.now() - startedAt,
      summary: results,
    })
  );
};
