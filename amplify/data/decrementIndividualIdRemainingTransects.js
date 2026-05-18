import { util } from '@aws-appsync/utils'

// Atomic decrement of IndividualIdJob.remainingTransects by 1. Returns the
// post-update value so the caller can detect the last transect (value === 0)
// without a separate read.
export function request(ctx) {
  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({ id: ctx.args.id }),
    update: {
      expression: 'ADD remainingTransects :neg1',
      expressionValues: util.dynamodb.toMapValues({ ':neg1': -1 }),
    },
    condition: {
      expression: 'attribute_exists(id)',
    },
  }
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type)
  }
  return ctx.result.remainingTransects
}
