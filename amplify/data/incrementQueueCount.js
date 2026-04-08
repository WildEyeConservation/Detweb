import { util } from '@aws-appsync/utils'

export function request(ctx) {
  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({ id: ctx.args.id }),
    update: {
      expression: 'ADD observedCount :inc',
      expressionValues: util.dynamodb.toMapValues({ ':inc': 1 }),
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
  return ctx.result.observedCount
}
