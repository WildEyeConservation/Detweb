import { limitConnections, gqlClient, graphqlOperation } from "./App";
import { GraphQLResult, GraphqlSubscriptionResult } from '@aws-amplify/api-graphql';

export type UnknownGraphQLResponse = GraphQLResult<any> | GraphqlSubscriptionResult<any>;

//The name of a FIFO queue can only include alphanumeric characters, hyphens, or underscores, must end with .fifo suffix and be 1 to 80 in length.
export function makeSafeQueueName(input: string): string {
  // Remove disallowed characters
  let sanitized = input.replace(/[^a-zA-Z0-9-_]/g, "_");
  // Ensure length is within limits (1 to 80 including .fifo)
  const maxMainLength = 75;
  if (sanitized.length > maxMainLength) {
    sanitized = sanitized.substring(0, maxMainLength);
  }
  return sanitized;
}



export async function gqlSend(op: any, inputs: Record<string, any> ): Promise<UnknownGraphQLResponse> {
  return limitConnections(() =>
    gqlClient.graphql(graphqlOperation(op, inputs)) as Promise<UnknownGraphQLResponse>,
  );
}

export async function gqlGetMany(query: any, inputs: Record<string, any>, progressCallback?: (count: number) => void) {
  let allItems: any[] = [];
  let nextToken: string | null | undefined = undefined;

  do {
    const response = await gqlSend(query, { ...inputs, nextToken });

    if ("data" in response) {
      const { items, nextToken: token } = response.data?.result1?.result2 || { items: [], nextToken: null };
      allItems = allItems.concat(items);
      nextToken = token;
    } else {
      throw new Error("Unexpected response format.");
    }

    progressCallback?.(allItems.length);
  } while (nextToken);

  return allItems;
}
