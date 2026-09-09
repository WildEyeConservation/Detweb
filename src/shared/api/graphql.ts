import type { GraphQLResult, GraphqlSubscriptionResult } from '@aws-amplify/api-graphql';

export type UnknownGraphQLResponse =
  | GraphQLResult<unknown>
  | GraphqlSubscriptionResult<unknown>;
