import { util } from '@aws-appsync/utils'

// Liveliness heartbeat: stamp lastActiveAt only if the caller is the user the
// transect is currently assigned to. The conditional write prevents a stale
// client (already released by the cron) from re-claiming activity.
export function request(ctx) {
  const uid = ctx.identity && ctx.identity.sub ? ctx.identity.sub : ''
  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({ id: ctx.args.id }),
    update: {
      expression: 'SET lastActiveAt = :now',
      expressionValues: util.dynamodb.toMapValues({ ':now': util.time.nowISO8601() }),
    },
    condition: {
      expression: 'assignedUserId = :uid',
      expressionValues: util.dynamodb.toMapValues({ ':uid': uid }),
    },
  }
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type)
  }
  return ctx.result
}
