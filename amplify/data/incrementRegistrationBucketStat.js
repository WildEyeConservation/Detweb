import { util } from '@aws-appsync/utils';

// Bypasses model-generated mutations, so createdAt/updatedAt/__typename
// must be stamped explicitly here.
export function request(ctx) {
  const { projectId, bucketKey, cameraPairKey, bucketIndex, group } = ctx.args;

  // Key attributes (projectId, bucketKey) must not appear in UpdateExpression —
  // DynamoDB rejects SET against a key attribute on upsert.
  const setParts = [
    '#cameraPairKey = if_not_exists(#cameraPairKey, :cameraPairKey)',
    '#bucketIndex = if_not_exists(#bucketIndex, :bucketIndex)',
    '#createdAt = if_not_exists(#createdAt, :now)',
    '#updatedAt = :now',
    '#typename = if_not_exists(#typename, :typename)',
  ];
  const expressionNames = {
    '#cameraPairKey': 'cameraPairKey',
    '#bucketIndex': 'bucketIndex',
    '#createdAt': 'createdAt',
    '#updatedAt': 'updatedAt',
    '#typename': '__typename',
  };
  const expressionValues = {
    ':cameraPairKey': cameraPairKey,
    ':bucketIndex': bucketIndex,
    ':inc': 1,
    ':now': util.time.nowISO8601(),
    ':typename': 'RegistrationBucketStat',
  };

  if (group != null) {
    expressionNames['#g'] = 'group';
    expressionValues[':group'] = group;
    setParts.push('#g = if_not_exists(#g, :group)');
  }

  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({
      projectId,
      bucketKey,
    }),
    update: {
      expression: 'ADD successCount :inc SET ' + setParts.join(', '),
      expressionNames,
      expressionValues: util.dynamodb.toMapValues(expressionValues),
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result;
}
