/**
 * Scans the DynamoDB datasource. Scans up to the provided `limit` and stards from the provided `NextToken` (optional).
 * @param {import('@aws-appsync/utils').Context} ctx the context
 * @returns {import('@aws-appsync/utils').DynamoDBScanRequest} the request
 */
export function request(ctx) {
  return {
    operation: 'Query',
    query: {
      expression: 'imageSetId = :imageSetId',
      expressionValues: util.dynamodb.toMapValues({ ':imageSetId': ctx.args.imageSetId }),
    },
    index: 'gsi-ImageSet.images', // Make sure this matches your GSI name
    select: 'COUNT',
  };
}

/**
 * Returns the scanned items
 * @param {import('@aws-appsync/utils').Context} ctx the context
 * @returns {*} a flat list of results from the Scan operation
 */
export function response(ctx) {
    return ctx.result.scannedCount;
}
