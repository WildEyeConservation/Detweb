import type { Schema } from "../resource"
import { env } from "$amplify/env/list-users"
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
  console.log(JSON.stringify(response))
  const userData=response.Users?.map((user) => ({
    id: user.Username,
    name: user.Attributes?.find((attr) => attr.Name === "preferred_username")?.Value,
    email: user.Attributes?.find((attr) => attr.Name === "email")?.Value,
    isAdmin: user.Attributes?.find((attr) => attr.Name === "custom:isAdmin")?.Value === "true",
  }))
  console.log(JSON.stringify(userData))
  return {
    Users: userData as any,
    NextToken: response.PaginationToken || null, // Include NextToken in the response
  }
}