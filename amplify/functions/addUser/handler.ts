// addToDb from './add-to-db'
import { PostConfirmationConfirmSignUpTriggerEvent } from "aws-lambda";
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {env} from '$amplify/env/addUser'

const addToGroup = async (event: PostConfirmationConfirmSignUpTriggerEvent) => {
  const cognitoIdentityServiceProvider = new CognitoIdentityProviderClient({});
  const addUserParams = {
    GroupName: env.GROUP,
    UserPoolId: event.userPoolId,
    Username: event.userName,
  };
  await cognitoIdentityServiceProvider.send(
    new AdminAddUserToGroupCommand(addUserParams),
  );
  return event;
};

export const handler = async (event: PostConfirmationConfirmSignUpTriggerEvent) => {
  await addToGroup(event);
  return event;
};
