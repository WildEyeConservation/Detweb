import type { Schema } from "../resource"
import { env } from "$amplify/env/add-user-to-group"
import {
  CreateGroupCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider"

type Handler = Schema["createGroup"]["functionHandler"]
const client = new CognitoIdentityProviderClient()

export const handler: Handler = async (event) => {
  const { groupName } = event.arguments
  const command = new CreateGroupCommand({
    GroupName: groupName,
    UserPoolId: env.AMPLIFY_AUTH_USERPOOL_ID,
  })
  const response = await client.send(command)
  const result = {
    $metadata: response.$metadata,
    Group: response.Group,
  }
  return result
}