import { util } from '@aws-appsync/utils'

// Atomic decrement of IndividualIdJob.pendingImageUpdates by `count`.
// DynamoDB ADD on a number is atomic per-item, so concurrent SQS consumers
// can decrement safely without a read-modify-write race.
export function request(ctx) {
  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({ id: ctx.args.id }),
    update: {
      expression: 'ADD pendingImageUpdates :neg',
      expressionValues: util.dynamodb.toMapValues({ ':neg': -ctx.args.count }),
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
  return ctx.result.pendingImageUpdates
}
