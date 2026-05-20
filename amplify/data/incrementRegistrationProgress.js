import { util } from '@aws-appsync/utils';

// Bypasses model-generated mutations, so createdAt/updatedAt/__typename
// must be stamped explicitly here.
export function request(ctx) {
  const {
    projectId,
    pairsCreatedDelta,
    pairsProcessedDelta,
    pendingCountDelta,
    kickoff,
    resetCleanupState,
    group,
  } = ctx.args;

  // projectId (key attribute) must not appear in UpdateExpression — DynamoDB
  // rejects SET against a key attribute on upsert.
  const addParts = [];
  const setParts = [
    '#createdAt = if_not_exists(#createdAt, :now)',
    '#updatedAt = :now',
    '#typename = if_not_exists(#typename, :typename)',
  ];
  const expressionNames = {
    '#cs': 'cleanupState',
    '#createdAt': 'createdAt',
    '#updatedAt': 'updatedAt',
    '#typename': '__typename',
  };
  const expressionValues = {
    ':now': util.time.nowISO8601(),
    ':typename': 'RegistrationProgress',
  };

  if (pairsCreatedDelta != null) {
    addParts.push('pairsCreated :created');
    expressionValues[':created'] = pairsCreatedDelta;
  }
  if (pairsProcessedDelta != null) {
    addParts.push('pairsProcessed :processed');
    expressionValues[':processed'] = pairsProcessedDelta;
  }

  if (pendingCountDelta != null) {
    addParts.push('pendingCount :pendingDelta');
    expressionValues[':pendingDelta'] = pendingCountDelta;
    expressionNames['#lastChangeAt'] = 'lastChangeAt';
    setParts.push('#lastChangeAt = :now');
  }

  if (kickoff) {
    expressionNames['#lastKickoffAt'] = 'lastKickoffAt';
    setParts.push('#lastKickoffAt = :now');
    setParts.push('#cs = :pending');
    expressionValues[':pending'] = 'pending';
  } else if (resetCleanupState) {
    setParts.push('#cs = :pending');
    expressionValues[':pending'] = 'pending';
  } else {
    setParts.push('#cs = if_not_exists(#cs, :pendingInit)');
    expressionValues[':pendingInit'] = 'pending';
  }

  if (group != null) {
    expressionNames['#g'] = 'group';
    expressionValues[':group'] = group;
    setParts.push('#g = if_not_exists(#g, :group)');
  }

  let expression = '';
  if (addParts.length > 0) {
    expression += 'ADD ' + addParts.join(', ');
  }
  if (setParts.length > 0) {
    expression += (expression ? ' ' : '') + 'SET ' + setParts.join(', ');
  }

  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({ projectId }),
    update: {
      expression,
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
