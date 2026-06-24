import { env } from '$amplify/env/revokeChainShare';
import { Amplify } from 'aws-amplify';
import { generateClient, GraphQLResult } from 'aws-amplify/data';
import type { RevokeChainShareHandler } from '../../data/resource';
import { assertSysadmin } from '../shared/authorizeRequest';

/**
 * Tear down a chain share's snapshot: delete every SharedChain* row for the
 * share and mark the ChainShare revoked. Reviewer accounts should be removed
 * from the `chainshare-<shareId>` group separately (via removeUserFromGroup);
 * ChainReviewFeedback is intentionally left intact as study output.
 */

const sharedChainAnnotationsByShareId = /* GraphQL */ `
  query AnnByShare($shareId: ID!, $nextToken: String) {
    sharedChainAnnotationsByShareId(shareId: $shareId, nextToken: $nextToken, limit: 1000) {
      items { id }
      nextToken
    }
  }
`;
const sharedChainImagesByShareId = /* GraphQL */ `
  query ImgByShare($shareId: ID!, $nextToken: String) {
    sharedChainImagesByShareId(shareId: $shareId, nextToken: $nextToken, limit: 1000) {
      items { id }
      nextToken
    }
  }
`;
const sharedChainLocationsByShareId = /* GraphQL */ `
  query LocByShare($shareId: ID!, $nextToken: String) {
    sharedChainLocationsByShareId(shareId: $shareId, nextToken: $nextToken, limit: 1000) {
      items { id }
      nextToken
    }
  }
`;
const sharedChainNeighboursByShareId = /* GraphQL */ `
  query NbrByShare($shareId: ID!, $nextToken: String) {
    sharedChainNeighboursByShareId(shareId: $shareId, nextToken: $nextToken, limit: 1000) {
      items { id }
      nextToken
    }
  }
`;
const sharedChainCategoriesByShareId = /* GraphQL */ `
  query CatByShare($shareId: ID!, $nextToken: String) {
    sharedChainCategoriesByShareId(shareId: $shareId, nextToken: $nextToken, limit: 1000) {
      items { id }
      nextToken
    }
  }
`;
const deleteSharedChainAnnotation = /* GraphQL */ `
  mutation Del($input: DeleteSharedChainAnnotationInput!) {
    deleteSharedChainAnnotation(input: $input) { id }
  }
`;
const deleteSharedChainImage = /* GraphQL */ `
  mutation Del($input: DeleteSharedChainImageInput!) {
    deleteSharedChainImage(input: $input) { id }
  }
`;
const deleteSharedChainLocation = /* GraphQL */ `
  mutation Del($input: DeleteSharedChainLocationInput!) {
    deleteSharedChainLocation(input: $input) { id }
  }
`;
const deleteSharedChainNeighbour = /* GraphQL */ `
  mutation Del($input: DeleteSharedChainNeighbourInput!) {
    deleteSharedChainNeighbour(input: $input) { id }
  }
`;
const deleteSharedChainCategory = /* GraphQL */ `
  mutation Del($input: DeleteSharedChainCategoryInput!) {
    deleteSharedChainCategory(input: $input) { id }
  }
`;
const updateChainShare = /* GraphQL */ `
  mutation UpdateChainShare($input: UpdateChainShareInput!) {
    updateChainShare(input: $input) { shareId status }
  }
`;

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

interface PagedList<T> {
  items: T[];
  nextToken: string | null | undefined;
}

async function fetchAllIds(
  query: string,
  queryName: string,
  shareId: string
): Promise<string[]> {
  const ids: string[] = [];
  let nextToken: string | undefined;
  do {
    // Concrete (non-generic) result type: a generic in the cast target defers
    // Amplify's variables conditional type and breaks the `variables` check.
    const response = await (client.graphql({
      query,
      variables: { shareId, nextToken },
    }) as Promise<GraphQLResult<Record<string, PagedList<{ id: string }>>>>);
    const page = response.data?.[queryName];
    ids.push(...((page?.items ?? []).map((i) => i.id)));
    nextToken = page?.nextToken ?? undefined;
  } while (nextToken);
  return ids;
}

async function deleteAll(
  ids: string[],
  mutation: string,
  limit = 20
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, ids.length) }, async () => {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      await client.graphql({ query: mutation, variables: { input: { id } } });
    }
  });
  await Promise.all(workers);
}

export const handler: RevokeChainShareHandler = async (event) => {
  try {
    assertSysadmin(event.identity);
    const { shareId } = event.arguments;

    const [annIds, imgIds, locIds, nbrIds, catIds] = await Promise.all([
      fetchAllIds(sharedChainAnnotationsByShareId, 'sharedChainAnnotationsByShareId', shareId),
      fetchAllIds(sharedChainImagesByShareId, 'sharedChainImagesByShareId', shareId),
      fetchAllIds(sharedChainLocationsByShareId, 'sharedChainLocationsByShareId', shareId),
      fetchAllIds(sharedChainNeighboursByShareId, 'sharedChainNeighboursByShareId', shareId),
      fetchAllIds(sharedChainCategoriesByShareId, 'sharedChainCategoriesByShareId', shareId),
    ]);

    await deleteAll(annIds, deleteSharedChainAnnotation);
    await deleteAll(imgIds, deleteSharedChainImage);
    await deleteAll(locIds, deleteSharedChainLocation);
    await deleteAll(nbrIds, deleteSharedChainNeighbour);
    await deleteAll(catIds, deleteSharedChainCategory);

    await client.graphql({
      query: updateChainShare,
      variables: { input: { shareId, status: 'revoked' } },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        shareId,
        deleted: {
          annotations: annIds.length,
          images: imgIds.length,
          locations: locIds.length,
          neighbours: nbrIds.length,
          categories: catIds.length,
        },
      }),
    };
  } catch (error) {
    console.error('revokeChainShare error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error revoking chain share',
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};
