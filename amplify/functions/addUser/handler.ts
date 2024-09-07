// addToDb from './add-to-db'
import { PostConfirmationConfirmSignUpTriggerEvent } from "aws-lambda";
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {env} from '$amplify/env/addUser'

const addToGroup = async (event: PostConfirmationConfirmSignUpTriggerEvent) => {
  const cognitoIdentityServiceProvider = new CognitoIdentityProviderClient({});
  // If the user is the first user to sign up for the app, add them to the sysadmin and orgadmin groups
  const getUsersParams = {
    UserPoolId: event.userPoolId,
  };
  const users = await cognitoIdentityServiceProvider.send(
    new ListUsersCommand(getUsersParams),
  );
  if (users.Users?.length === 1) {
  await cognitoIdentityServiceProvider.send(
    new AdminAddUserToGroupCommand({
      GroupName: "sysadmin",
      UserPoolId: event.userPoolId,
      Username: event.userName,
    }))
  await cognitoIdentityServiceProvider.send(
    new AdminAddUserToGroupCommand({
      GroupName: "orgadmin",
      UserPoolId: event.userPoolId,
      Username: event.userName,
    }));
  }
  return event;
};

export const handler = async (event: PostConfirmationConfirmSignUpTriggerEvent) => {
  await addToGroup(event);
  return event;
};
