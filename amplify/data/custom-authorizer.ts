import type { AppSyncAuthorizerHandler } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

// Singleton instances (reused across Lambda invocations)
const dynamoClient = new DynamoDBClient({});
const ssmClient = new SSMClient({});

// Lazy-initialized JWT verifier (created on first invocation via async init)
let verifierPromise: Promise<ReturnType<typeof CognitoJwtVerifier.create>> | null = null;

async function resolveUserPoolId(): Promise<string> {
  // Direct env var (if available)
  if (process.env.USERPOOL_ID) {
    return process.env.USERPOOL_ID;
  }

  // Resolve via SSM parameter
  const paramName = process.env.USERPOOL_ID_PARAM;
  if (!paramName) {
    throw new Error('Neither USERPOOL_ID nor USERPOOL_ID_PARAM is set');
  }

  const result = await ssmClient.send(
    new GetParameterCommand({ Name: paramName })
  );
  const value = result.Parameter?.Value;
  if (!value) {
    throw new Error(`SSM parameter ${paramName} not found or empty`);
  }
  return value;
}

function getVerifier(): Promise<ReturnType<typeof CognitoJwtVerifier.create>> {
  if (!verifierPromise) {
    verifierPromise = resolveUserPoolId().then((userPoolId) =>
      CognitoJwtVerifier.create({
        userPoolId,
        tokenUse: 'access',
        clientId: null,
      })
    );
  }
  return verifierPromise;
}

// ---------------------------------------------------------------------------
// Whitelists
// ---------------------------------------------------------------------------

/** Custom mutations/queries that bypass org checks (they have their own Lambda handlers). */
const WHITELISTED_OPERATIONS = new Set([
  'addUserToGroup',
  'removeUserFromGroup',
  'createGroup',
  'listUsers',
  'listGroupsForUser',
  'processImages',
  'runScoutbot',
  'runMadDetector',
  'runHeatmapper',
  'runImageRegistration',
  'deleteProjectInFull',
  'generateSurveyResults',
  'launchAnnotationSet',
  'launchFalseNegatives',
  'getJwtSecret',
  'updateProjectMemberships',
  'getImageCounts',
  'publish',
]);

/** Models whose CRUD operations bypass org checks. */
const WHITELISTED_MODELS = new Set(['Organization']);

// ---------------------------------------------------------------------------
// Composite key definitions for models that don't use a standard `id` PK.
// ---------------------------------------------------------------------------
const MODEL_KEY_FIELDS: Record<string, string[]> = {
  OrganizationMembership: ['organizationId', 'userId'],
  ImageProcessedBy: ['imageId', 'source'],
  LocationAnnotationCount: ['locationId', 'categoryId', 'annotationSetId'],
  ImageNeighbour: ['image1Id', 'image2Id'],
  UserStats: ['projectId', 'userId', 'date', 'setId'],
  CameraOverlap: ['cameraAId', 'cameraBId'],
  TestPresetProject: ['testPresetId', 'projectId'],
  TestPresetLocation: ['testPresetId', 'locationId', 'annotationSetId'],
  TestResultCategoryCount: ['testResultId', 'categoryName'],
  JollyResult: ['surveyId', 'stratumId', 'annotationSetId', 'categoryId'],
  JollyResultsMembership: ['surveyId', 'annotationSetId', 'userId'],
  ResultSharingToken: ['surveyId', 'annotationSetId'],
  ProjectTestConfig: ['projectId'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTableName(modelName: string, apiId: string): string {
  return `${modelName}-${apiId}-NONE`;
}

function allow(ttl = 0) {
  return { isAuthorized: true as const, ttlOverride: ttl };
}

function deny() {
  return { isAuthorized: false as const, ttlOverride: 0 };
}

// ---------------------------------------------------------------------------
// Step B – Parse the GraphQL operation
// ---------------------------------------------------------------------------

interface ParsedOperation {
  action: string | null;
  model: string | null;
  operationName: string;
}

function parseOperation(queryString: string): ParsedOperation {
  // Extract the root field name (e.g. "createProject", "listProjects", "categoriesByAnnotationSetId")
  const rootFieldRegex = /\{\s*([a-zA-Z0-9_]+)[\s({]/;
  const match = queryString.match(rootFieldRegex);
  const operationName = match?.[1] ?? '';

  // Try to extract action and model from standard CRUD pattern
  const patternRegex = /^(get|update|delete|list|create)(.+)$/;
  const patternMatch = operationName.match(patternRegex);

  if (patternMatch) {
    const action = patternMatch[1];
    let model = patternMatch[2];
    // For list queries Amplify appends 's' to the model name
    if (action === 'list' && model.endsWith('s')) {
      model = model.slice(0, -1);
    }
    return { action, model, operationName };
  }

  // Non-standard operation (custom index query, custom mutation, etc.)
  return { action: null, model: null, operationName };
}

// ---------------------------------------------------------------------------
// Step B (cont.) – Extract & validate the organization ID
// ---------------------------------------------------------------------------

/** Strategy 1 – Strict filter validation for list / custom-index queries. */
function validateStrictFilter(
  variables: Record<string, any>
): string | null {
  const filter = variables?.filter;
  if (!filter || typeof filter !== 'object') return null;

  const topLevelKeys = Object.keys(filter);
  if (topLevelKeys.length !== 1 || topLevelKeys[0] !== 'organizationId') {
    return null;
  }

  const orgCondition = filter.organizationId;
  if (!orgCondition || typeof orgCondition !== 'object') return null;

  const conditionKeys = Object.keys(orgCondition);
  if (conditionKeys.length !== 1 || conditionKeys[0] !== 'eq') {
    return null;
  }

  const orgId = orgCondition.eq;
  if (typeof orgId !== 'string' || orgId.length === 0) {
    return null;
  }

  return orgId;
}

// ---------------------------------------------------------------------------
// Strategy 2 – Fetch and verify (get / update / delete)
// ---------------------------------------------------------------------------

async function fetchRecord(
  model: string,
  variables: Record<string, any>,
  apiId: string
): Promise<Record<string, any> | null> {
  const tableName = getTableName(model, apiId);
  const keyFields = MODEL_KEY_FIELDS[model] || ['id'];

  // Resolve each key value from top-level variables or nested input
  const resolvedKeys: Record<string, string> = {};
  for (const field of keyFields) {
    const value = variables[field] ?? variables.input?.[field];
    if (value === undefined || value === null) return null;
    resolvedKeys[field] = String(value);
  }

  // For 3+ field composite keys, use Query + client-side filter
  // (Amplify may combine extra fields into a composite sort key whose
  //  internal structure we don't want to guess.)
  if (keyFields.length > 2) {
    try {
      const pkField = keyFields[0];
      const remainingFields = keyFields.slice(1);

      let lastEvaluatedKey: Record<string, any> | undefined;
      do {
        const result = await dynamoClient.send(
          new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: '#pk = :pk',
            ExpressionAttributeNames: { '#pk': pkField },
            ExpressionAttributeValues: {
              ':pk': { S: resolvedKeys[pkField] },
            },
            Limit: 1000,
            ExclusiveStartKey: lastEvaluatedKey,
          })
        );

        for (const item of result.Items ?? []) {
          const record = unmarshall(item);
          const matches = remainingFields.every(
            (f) => String(record[f]) === resolvedKeys[f]
          );
          if (matches) return record;
        }

        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      return null;
    } catch (error) {
      console.error('Query for composite-key record failed:', error);
      return null;
    }
  }

  // For 1–2 field keys, use GetItem directly
  const key: Record<string, { S: string }> = {};
  for (const field of keyFields) {
    key[field] = { S: resolvedKeys[field] };
  }

  try {
    const result = await dynamoClient.send(
      new GetItemCommand({ TableName: tableName, Key: key })
    );
    if (!result.Item) return null;
    return unmarshall(result.Item);
  } catch (error) {
    console.error('GetItem failed:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step C – Organization membership check
// ---------------------------------------------------------------------------

async function checkMembership(
  organizationId: string,
  userId: string,
  apiId: string
): Promise<boolean> {
  const tableName = getTableName('OrganizationMembership', apiId);

  try {
    const result = await dynamoClient.send(
      new GetItemCommand({
        TableName: tableName,
        Key: {
          organizationId: { S: organizationId },
          userId: { S: userId },
        },
      })
    );
    return !!result.Item;
  } catch (error) {
    console.error('Membership check failed:', error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const handler: AppSyncAuthorizerHandler = async (event) => {
  console.log(`EVENT: ${JSON.stringify(event)}`);

  const {
    authorizationToken,
    requestContext: { apiId, queryString },
  } = event;
  const variables: Record<string, any> =
    event.requestContext.variables ?? {};

  try {
    // ------------------------------------------------------------------
    // Step A – Verify JWT & identify user
    // ------------------------------------------------------------------
    const verifier = await getVerifier();
    const payload = await verifier.verify(authorizationToken);
    const userId = payload.sub;
    const groups: string[] =
      (payload['cognito:groups'] as string[] | undefined) ?? [];

    // Sysadmin bypass – safe to cache (no per-query checks needed)
    if (groups.includes('sysadmin')) {
      return allow(300);
    }

    // ------------------------------------------------------------------
    // Step B – Parse the operation
    // ------------------------------------------------------------------
    const { action, model, operationName } = parseOperation(queryString);

    // Allow GraphQL introspection queries
    if (operationName.startsWith('__')) {
      return allow(0);
    }

    // Whitelist: custom mutations/queries with their own Lambda handlers
    if (WHITELISTED_OPERATIONS.has(operationName)) {
      return allow(0);
    }

    // Whitelist: models that bypass org checks
    if (model && WHITELISTED_MODELS.has(model)) {
      return allow(0);
    }

    // ------------------------------------------------------------------
    // Step B (cont.) – Extract organizationId based on operation type
    // ------------------------------------------------------------------
    let organizationId: string | null = null;

    if (action === 'list' || action === null) {
      // Strategy 1 – Strict filter validation (list & custom index queries)
      organizationId = validateStrictFilter(variables);
      if (!organizationId) {
        console.log(
          'Denied: Missing or invalid organizationId filter for list/custom query'
        );
        return deny();
      }
    } else if (action === 'create') {
      // Strategy 3 – Input validation
      organizationId = variables?.input?.organizationId ?? null;
      if (!organizationId) {
        console.log('Denied: Missing organizationId in create input');
        return deny();
      }
    } else if (
      action === 'get' ||
      action === 'update' ||
      action === 'delete'
    ) {
      // Strategy 2 – Fetch and verify
      if (!model) {
        console.log('Denied: Could not determine model for fetch-verify');
        return deny();
      }
      const record = await fetchRecord(model, variables, apiId);
      if (!record) {
        console.log('Denied: Record not found');
        return deny();
      }
      organizationId = record.organizationId ?? null;
      if (!organizationId) {
        console.log('Denied: Record has no organizationId');
        return deny();
      }
    }

    if (!organizationId) {
      console.log('Denied: Could not extract organizationId');
      return deny();
    }

    // ------------------------------------------------------------------
    // Step C – Organization membership check
    // ------------------------------------------------------------------
    const isMember = await checkMembership(organizationId, userId, apiId);

    if (!isMember) {
      console.log(
        `Denied: User ${userId} is not a member of org ${organizationId}`
      );
      return deny();
    }

    // Per-query validation – do NOT cache (ttl: 0)
    return allow(0);
  } catch (error) {
    console.error('Authorization error:', error);
    return deny();
  }
};
