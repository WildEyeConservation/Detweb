import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import pLimit from 'p-limit';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { env } from '$amplify/env/pretileImage';

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
        clearCredentialsAndIdentityId: () => {},
      },
    },
  }
);

const client = generateClient({ authMode: 'iam' });
const s3 = new S3Client();

// ── GraphQL ──

const getImageTiledAtQuery = /* GraphQL */ `
  query GetImage($id: ID!) {
    getImage(id: $id) {
      id
      tiledAt
    }
  }
`;

const updateImageMutation = /* GraphQL */ `
  mutation UpdateImage($input: UpdateImageInput!) {
    updateImage(input: $input) {
      id
    }
  }
`;

// ── Helpers ──

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function s3PutWithRetry(params, maxRetries = 5) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await s3.send(new PutObjectCommand(params));
    } catch (err) {
      const retryable =
        err.name === 'SlowDown' ||
        err.name === 'ThrottlingException' ||
        err.$metadata?.httpStatusCode === 503 ||
        err.$metadata?.httpStatusCode === 429;
      if (!retryable || attempt >= maxRetries) throw err;
      const baseMs = Math.min(1000 * Math.pow(2, attempt), 16000);
      const jitter = Math.random() * baseMs;
      await new Promise((r) => setTimeout(r, baseMs + jitter));
    }
  }
}

async function uploadDir(localDir, s3Prefix, bucket) {
  const entries = await fs.readdir(localDir);
  const limit = pLimit(4);
  await Promise.all(
    entries.map((entry) =>
      limit(async () => {
        const localPath = path.join(localDir, entry);
        const s3Path = `${s3Prefix}/${entry}`;
        const stats = await fs.stat(localPath);
        if (stats.isFile()) {
          return s3PutWithRetry({
            Bucket: bucket,
            Key: s3Path,
            Body: await fs.readFile(localPath),
            ContentType: entry.endsWith('.png') ? 'image/png' : undefined,
          });
        } else if (stats.isDirectory()) {
          return uploadDir(localPath, s3Path, bucket);
        }
      })
    )
  );
}

async function readTiledAt(imageId) {
  const resp = await client.graphql({ query: getImageTiledAtQuery, variables: { id: imageId } });
  return resp.data?.getImage?.tiledAt ?? null;
}

async function stampTiledAt(imageId) {
  await client.graphql({
    query: updateImageMutation,
    variables: { input: { id: imageId, tiledAt: new Date().toISOString() } },
  });
}

// ── Handler ──

export const handler = async (event) => {
  for (const record of event.Records ?? []) {
    const body = JSON.parse(record.body);
    const { imageId, sourceKey, launchId, manifestCreatedAt } = body;

    if (!imageId || !sourceKey) {
      throw new Error(
        `pretileImage: missing imageId/sourceKey in message body: ${record.body}`
      );
    }

    // Race guard — only skip if another launch tiled this image AFTER our
    // manifest was created. A tiledAt that predates the manifest means the
    // stamp is stale (this is exactly why this image was routed here), so we
    // must re-tile and re-stamp it; otherwise the reconciler will wait forever.
    const existingTiledAt = await readTiledAt(imageId);
    const manifestCreatedAtMs = manifestCreatedAt ? Date.parse(manifestCreatedAt) : NaN;
    const existingTiledAtMs = existingTiledAt ? Date.parse(existingTiledAt) : NaN;
    const tiledByLaterLaunch =
      Number.isFinite(existingTiledAtMs) &&
      Number.isFinite(manifestCreatedAtMs) &&
      existingTiledAtMs >= manifestCreatedAtMs;
    if (tiledByLaterLaunch) {
      console.log(
        JSON.stringify({
          msg: 'pretile_skip_already_tiled',
          imageId,
          launchId,
          existingTiledAt,
          manifestCreatedAt,
        })
      );
      continue;
    }

    console.log(
      JSON.stringify({ msg: 'pretile_fetch_source', imageId, sourceKey, launchId })
    );
    const fetchStart = Date.now();
    const getResp = await s3.send(
      new GetObjectCommand({ Bucket: env.INPUTS_BUCKET_NAME, Key: sourceKey })
    );
    const buffer = await streamToBuffer(getResp.Body);
    const fetchMs = Date.now() - fetchStart;
    const sourceMB = +(buffer.length / (1024 * 1024)).toFixed(2);

    const localTmpPath = `/tmp/tiles-${imageId}`;
    try {
      await fs.rm(localTmpPath, { recursive: true, force: true });
    } catch {}
    await fs.mkdir(localTmpPath, { recursive: true });

    console.log(JSON.stringify({ msg: 'pretile_sharp_start', imageId }));
    const sharpStart = Date.now();
    await sharp(buffer)
      .rotate()
      .png()
      .tile({ layout: 'google' })
      .toFile(localTmpPath);
    const sharpMs = Date.now() - sharpStart;

    // Match the key shape used by the on-demand generator:
    // slippymaps/<sourceKey-without-'images/'-prefix>/z/r/c.png
    const outputPrefix = sourceKey.replace(/^images\//, 'slippymaps/');
    console.log(
      JSON.stringify({ msg: 'pretile_upload_start', imageId, outputPrefix })
    );
    const uploadStart = Date.now();
    await uploadDir(localTmpPath, outputPrefix, env.OUTPUTS_BUCKET_NAME);
    const uploadMs = Date.now() - uploadStart;

    await stampTiledAt(imageId);

    try {
      await fs.rm(localTmpPath, { recursive: true, force: true });
    } catch {}

    console.log(
      JSON.stringify({
        msg: 'pretile_complete',
        imageId,
        launchId,
        sourceMB,
        fetchMs,
        sharpMs,
        uploadMs,
      })
    );
  }
};
