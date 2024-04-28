import { limitConnections, gqlClient, graphqlOperation } from "./App";

//The name of a FIFO queue can only include alphanumeric characters, hyphens, or underscores, must end with .fifo suffix and be 1 to 80 in length.
export function makeSafeQueueName(input) {
  // Remove disallowed characters
  let sanitized = input.replace(/[^a-zA-Z0-9-_]/g, "_");
  // Ensure length is within limits (1 to 80 including .fifo)
  const maxMainLength = 75;
  if (sanitized.length > maxMainLength) {
    sanitized = sanitized.substring(0, maxMainLength);
  }
  return sanitized;
}

export async function gqlSend(op, inputs) {
  return limitConnections(() =>
    gqlClient.graphql(graphqlOperation(op, inputs)),
  );
}

export async function gqlGetMany(query, inputs, progressCallback) {
  let allItems = [];
  let nextToken = undefined;
  do {
    let items;
    ({
      data: {
        result1: {
          result2: { items, nextToken },
        },
      },
    } = await gqlSend(query, { ...inputs, nextToken }));
    allItems = allItems.concat(items);
    progressCallback?.(allItems.length);
  } while (nextToken);
  return allItems;
}
