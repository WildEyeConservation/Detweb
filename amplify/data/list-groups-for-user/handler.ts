import type { ListGroupsForUserHandler } from "../resource"
import { env } from "$amplify/env/list-groups-for-user"
import {
  CognitoIdentityProviderClient,
  AdminListGroupsForUserCommand,
} from "@aws-sdk/client-cognito-identity-provider"

type Handler = ListGroupsForUserHandler
const client = new CognitoIdentityProviderClient()
export const handler: Handler = async (event) => {
  const command = new AdminListGroupsForUserCommand({
    UserPoolId: env.AMPLIFY_AUTH_USERPOOL_ID,
    Username: event.arguments.userId,
    NextToken: event.arguments.nextToken || undefined,
  })
  const response = await client.send(command)
  return response
}