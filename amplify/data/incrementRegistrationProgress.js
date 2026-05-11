import { util } from '@aws-appsync/utils';

// Atomic upsert of a RegistrationProgress row keyed by projectId.
// All deltas are optional — caller passes whichever counters need bumping,
// plus an optional resetCleanupState flag for the runImageRegistration kickoff
// path. createdAt / updatedAt / __typename are stamped here because we're
// bypassing the model's auto-generated mutations.
export function request(ctx) {
  const {
    projectId,
    pairsCreatedDelta,
    pairsProcessedDelta,
    resetCleanupState,
    group,
  } = ctx.args;

  // The key attribute (projectId) must NOT appear in the UpdateExpression —
  // DynamoDB writes it from the Key parameter automatically on upsert and
  // rejects any attempt to SET a key attribute on an existing item with
  // "Cannot update attribute projectId. This attribute is part of the key".
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

  // resetCleanupState forces 'pending' even on an existing row (used at the
  // start of a new runImageRegistration cycle). Otherwise initialise to
  // 'pending' only when the row is brand new.
  if (resetCleanupState) {
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
