/**
 * Queries the DynamoDB datasource with pagination support
 * @param {import('@aws-appsync/utils').Context} ctx the context
 * @returns {import('@aws-appsync/utils').DynamoDBQueryRequest} the request
 */
export function request(ctx) {
  const query = {
    operation: 'Query',
    query: {
      expression: 'imageSetId = :imageSetId',
      expressionValues: util.dynamodb.toMapValues({ ':imageSetId': ctx.args.imageSetId }),
    },
    index: 'gsi-ImageSet.images', // Make sure this matches your GSI name
    select: 'COUNT',
    limit: 10000, // Increase the limit
    nextToken: ctx.args.nextToken // Handle pagination
  };
  
  return query;
}

/**
 * Accumulates counts across paginated results
 * @param {import('@aws-appsync/utils').Context} ctx the context
 * @returns {number} total count of items
 */
export function response(ctx) {
    if (ctx.error) {
        util.error(ctx.error.message, ctx.error.type);
    }

    return {
        count: ctx.result.scannedCount,
        nextToken: ctx.result.nextToken || undefined
    };
}