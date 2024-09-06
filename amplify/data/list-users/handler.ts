import type { Schema } from "../resource"
import { env } from "$amplify/env/add-user-to-group"
import {
  ListUsersCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider"

type Handler = Schema["listUsers"]["functionHandler"]
const client = new CognitoIdentityProviderClient()
export const handler: Handler = async (event) => {
  const command = new ListUsersCommand({
    UserPoolId: env.AMPLIFY_AUTH_USERPOOL_ID,
    PaginationToken: event.arguments.nextToken || undefined,
  })
  const response = await client.send(command)
  const userData=response.Users?.map((user) => ({
    id: user.Username,
    name: user.Attributes?.find((attr) => attr.Name === "email")?.Value,
    isAdmin: user.Attributes?.find((attr) => attr.Name === "custom:isAdmin")?.Value === "true",
  }))
  return {
    Users: userData as any,
    NextToken: response.PaginationToken || null, // Include NextToken in the response
  }
}