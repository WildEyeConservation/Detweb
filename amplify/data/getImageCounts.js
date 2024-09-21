import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'Query',
    index: 'imageSetId-index', // Make sure this matches your GSI name
    select: 'COUNT',
    query: {
      expression: 'imageSetId = :imageSetId',
      expressionValues: util.dynamodb.toMapValues({ ':imageSetId': ctx.args.imageSetId }),
    },
  };
}

export function response(ctx) {
  return ctx.result.Count;
}