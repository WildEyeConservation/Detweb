import type { DynamoDBStreamHandler } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const logger = new Logger({
  logLevel: "INFO",
  serviceName: "backfill-location-group",
});

const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const LOCATION_TABLE = process.env.LOCATION_TABLE_NAME!;
const PROJECT_TABLE = process.env.PROJECT_TABLE_NAME!;

// Warm-container cache: projectId → organizationId
const organizationIdCache: Record<string, string | undefined> = {};

async function getOrganizationId(projectId: string): Promise<string | undefined> {
  if (projectId in organizationIdCache) return organizationIdCache[projectId];

  try {
    const result = await ddbClient.send(
      new GetCommand({
        TableName: PROJECT_TABLE,
        Key: { id: projectId },
        ProjectionExpression: "organizationId",
      })
    );
    const organizationId = result.Item?.organizationId as string | undefined;
    organizationIdCache[projectId] = organizationId;
    return organizationId;
  } catch (error) {
    logger.error("Failed to fetch organizationId for project", {
      projectId,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

export const handler: DynamoDBStreamHandler = async (event) => {
  logger.info(`Processing ${event.Records.length} records`);

  // Collect INSERTs that need backfilling, grouped by projectId
  const toBackfill = new Map<string, string[]>(); // projectId → locationId[]

  for (const record of event.Records) {
    if (record.eventName !== "INSERT") continue;

    const newImage = record.dynamodb?.NewImage;
    if (!newImage) continue;

    // Skip if group is already set
    const existingGroup = newImage.group?.S;
    if (existingGroup && existingGroup.length > 0) continue;

    const locationId = newImage.id?.S;
    const projectId = newImage.projectId?.S;
    if (!locationId || !projectId) {
      logger.warn("INSERT missing id or projectId", { locationId, projectId });
      continue;
    }

    const ids = toBackfill.get(projectId) ?? [];
    ids.push(locationId);
    toBackfill.set(projectId, ids);
  }

  if (toBackfill.size === 0) {
    logger.info("No locations to backfill");
    return { batchItemFailures: [] };
  }

  for (const [projectId, locationIds] of toBackfill) {
    const organizationId = await getOrganizationId(projectId);
    if (!organizationId) {
      logger.warn("No organizationId found for project, skipping locations", {
        projectId,
        locationCount: locationIds.length,
      });
      continue;
    }

    logger.info(`Backfilling ${locationIds.length} locations for project ${projectId} with group ${organizationId}`);

    await Promise.all(
      locationIds.map(async (locationId) => {
        try {
          await ddbClient.send(
            new UpdateCommand({
              TableName: LOCATION_TABLE,
              Key: { id: locationId },
              UpdateExpression: "SET #g = :g",
              ConditionExpression: "attribute_not_exists(#g) OR #g = :empty",
              ExpressionAttributeNames: { "#g": "group" },
              ExpressionAttributeValues: { ":g": organizationId, ":empty": "" },
            })
          );
          logger.info(`Set group for location ${locationId}`);
        } catch (error: any) {
          // ConditionalCheckFailedException means group was already set (race condition) — safe to ignore
          if (error.name === "ConditionalCheckFailedException") {
            logger.info(`Location ${locationId} already has group set, skipping`);
          } else {
            logger.error(`Failed to update location ${locationId}`, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      })
    );
  }

  return { batchItemFailures: [] };
};
