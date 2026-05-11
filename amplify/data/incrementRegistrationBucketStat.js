import { util } from '@aws-appsync/utils';

// Atomic upsert + ADD 1 on RegistrationBucketStat.successCount, keyed by
// (projectId, cameraPairKey, bucketIndex). createdAt / updatedAt / __typename
// stamped explicitly because we're bypassing the model's auto-generated
// mutations.
export function request(ctx) {
  const { projectId, cameraPairKey, bucketIndex, group } = ctx.args;

  // The composite key (projectId, cameraPairKey, bucketIndex) must NOT appear
  // in the UpdateExpression — DynamoDB writes it from the Key parameter on
  // upsert and rejects any SET against a key attribute with
  // "Cannot update attribute X. This attribute is part of the key".
  const setParts = [
    '#createdAt = if_not_exists(#createdAt, :now)',
    '#updatedAt = :now',
    '#typename = if_not_exists(#typename, :typename)',
  ];
  const expressionNames = {
    '#createdAt': 'createdAt',
    '#updatedAt': 'updatedAt',
    '#typename': '__typename',
  };
  const expressionValues = {
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
      cameraPairKey,
      bucketIndex,
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
