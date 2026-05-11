import { util } from '@aws-appsync/utils';

// Atomic upsert + ADD 1 on RegistrationBucketStat.successCount, keyed by
// (projectId, bucketKey). cameraPairKey and bucketIndex are denormalised
// attributes stamped on first write so the cleanup lambda can group/sort
// without parsing the composite key. createdAt / updatedAt / __typename
// stamped explicitly because we're bypassing the model's auto-generated
// mutations.
export function request(ctx) {
  const { projectId, bucketKey, cameraPairKey, bucketIndex, group } = ctx.args;

  // Key attributes (projectId, bucketKey) must NOT appear in the
  // UpdateExpression — DynamoDB writes them from the Key parameter on upsert
  // and rejects any SET against a key attribute. cameraPairKey and bucketIndex
  // are non-key attributes, so they DO get set here (only on first write,
  // via if_not_exists).
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
