import React, { createContext, useState, useEffect } from "react";
export const UserContext = createContext([]);
import { useProjectMemberships, useUsers } from "./useGqlCached";
import backend from "./cdk-exports.json";
import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
  GetQueueUrlCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  DeleteMessageCommand,
  SQSClient,
  ChangeMessageVisibilityCommand,
} from "@aws-sdk/client-sqs";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity";
import { limitConnections } from "./App";
import { gqlSend, gqlGetMany } from "./utils";
import { fetchAuthSession } from "aws-amplify/auth";

export default function User({ loggedInUser, children }) {
  const { users, updateUser } = useUsers();
  const [jobsCompleted, setJobsCompleted] = useState(0);
  const { projectMemberships } = useProjectMemberships();
  const [user, setUser] = useState(undefined);
  const [credentials, setCredentials] = useState(undefined);
  const [projects, setProjects] = useState(undefined);
  const [currentPM, setCurrentPM] = useState(undefined);
  const [sqsClient, setSqsClient] = useState();
  const [s3Client, setS3Client] = useState();
  const [lambdaClient, setLambdaClient] = useState();
  const [cognitoClient, setCognitoClient] = useState();

  const region = backend["detweb-stack-develop"].ProjectRegion;
  const cognitoRegion = backend["detweb-cognitostack-develop"].Cognitoregion;

  // useEffect(()=>{
  //   const setup = async()=>{
  //     credentials = Auth.essentialCredentials(await Auth.currentCredentials())
  //     setCredentials(credentials);
  //     setLambdaClient(new LambdaClient({ region, credentials }));
  //     setS3Client(new S3Client({ region, credentials }));
  //     setCognitoClient(new CognitoIdentityProviderClient({region:cognitoRegion, credentials}))
  //     setSqsClient(new SQSClient({region, credentials}))
  //   }
  //   setup()
  // },[loggedInUser])

  useEffect(() => {
    async function refreshCredentials() {
      const { credentials } = await fetchAuthSession();
      setCredentials(credentials);
      setSqsClient(new SQSClient({ region, credentials }));
      setCognitoClient(
        new CognitoIdentityProviderClient({
          region: cognitoRegion,
          credentials,
        }),
      );
      setLambdaClient(new LambdaClient({ region, credentials }));
      setS3Client(new S3Client({ region, credentials }));
    }
    refreshCredentials();
    const user = users?.find((user_) => user_.id == loggedInUser.username);
    setUser(user);
    const timer = setInterval(refreshCredentials, 30 * 60 * 1000); //Refresh credentials every 30 minutes
    return () => clearInterval(timer);
  }, [loggedInUser, users]);

  async function sqsSend(command) {
    return limitConnections(() => sqsClient.send(command));
  }

  async function lambdaSend(command) {
    return limitConnections(() => lambdaClient.send(command));
  }

  async function invoke(config) {
    return lambdaSend(new InvokeCommand(config));
  }

  async function s3Send(command) {
    return limitConnections(() => s3Client.send(command));
  }

  async function cognitoSend(command) {
    return limitConnections(() => cognitoClient.send(command));
  }

  async function getObject(config) {
    return s3Send(new GetObjectCommand(config));
  }

  async function sendToQueue(config) {
    return sqsSend(new SendMessageCommand(config));
  }

  async function getFromQueue(config) {
    return sqsSend(new ReceiveMessageCommand(config));
  }

  async function refreshVisibility(config) {
    return sqsSend(new ChangeMessageVisibilityCommand(config));
  }

  async function getQueueUrl(config) {
    return sqsSend(new GetQueueUrlCommand(config));
  }

  async function deleteFromQueue(config) {
    return sqsSend(new DeleteMessageCommand(config));
  }

  async function createQueue(config) {
    return sqsSend(new CreateQueueCommand(config));
  }

  async function getQueueAttributes(config) {
    return sqsSend(new GetQueueAttributesCommand(config));
  }

  async function addUserToGroup(config) {
    return cognitoSend(new AdminAddUserToGroupCommand(config));
  }

  async function removeUserFromGroup(config) {
    return cognitoSend(new AdminRemoveUserFromGroupCommand(config));
  }

  useEffect(() => {
    if (user) {
      const projects = projectMemberships
        ?.filter((pm) => pm.userId == user.id)
        .map((pm) => pm.projectId);
      setProjects(projects);
    }
  }, [projectMemberships, user]);

  useEffect(() => {
    if (user) {
      setCurrentPM(
        projectMemberships?.find(
          (pm) => pm.userId == user.id && pm.projectId == user.currentProjectId,
        ),
      );
    }
  }, [projectMemberships, user]);

  const setCurrentProject = async (projectId) => {
    if (user.currentProjectId != projectId) {
      updateUser({ id: user?.id, currentProjectId: projectId });
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        backend,
        gqlSend,
        gqlGetMany,
        sendToQueue,
        getFromQueue,
        refreshVisibility,
        createQueue,
        getQueueAttributes,
        setCurrentProject,
        addUserToGroup,
        removeUserFromGroup,
        getQueueUrl,
        deleteFromQueue,
        jobsCompleted,
        setJobsCompleted,
        getObject,
        invoke,
        cognitoClient,
        s3Client,
        lambdaClient,
        region,
        cognitoRegion: backend["detweb-cognitostack-develop"].Cognitoregion,
        credentials,
        projects,
        currentProject: user?.currentProjectId,
        currentQueue: currentPM?.queueUrl,
      }}
    >
      {credentials && children}
    </UserContext.Provider>
  );
}
