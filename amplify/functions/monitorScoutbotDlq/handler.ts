import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/monitorScoutbotDlq';
import {
  SQSClient,
  GetQueueAttributesCommand,
  GetQueueUrlCommand,
  ReceiveMessageCommand,
  SendMessageBatchCommand,
  DeleteMessageBatchCommand,
} from '@aws-sdk/client-sqs';
import {
  ECSClient,
  ListClustersCommand,
  DescribeClustersCommand,
  ListServicesCommand,
  DescribeServicesCommand,
} from '@aws-sdk/client-ecs';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

// SQS client reused across invocations.
const sqsClient = new SQSClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    sessionToken: env.AWS_SESSION_TOKEN,
  },
});

// ECS client reused across invocations.
const ecsClient = new ECSClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    sessionToken: env.AWS_SESSION_TOKEN,
  },
});

// SSM client for reading queue URL parameter.
const ssmClient = new SSMClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    sessionToken: env.AWS_SESSION_TOKEN,
  },
});

type QueueStats = {
  available: number;
  inflight: number;
  delayed: number;
};

type DlqInfo = {
  arn: string;
  url: string;
};

/**
 * Main Lambda handler that monitors the Scoutbot DLQ and orchestrates
 * queue draining and requeuing to work around the processing bug.
 */
export const handler: Handler = async () => {
  const queueUrlParam = env.SCOUTBOT_QUEUE_URL_PARAM;

  if (!queueUrlParam) {
    console.error('SCOUTBOT_QUEUE_URL_PARAM environment variable is not set');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'SCOUTBOT_QUEUE_URL_PARAM not configured' }),
    };
  }

  // Read the actual queue URL from SSM Parameter Store
  let scoutbotQueueUrl: string;
  try {
    const ssmResponse = await ssmClient.send(
      new GetParameterCommand({ Name: queueUrlParam })
    );
    scoutbotQueueUrl = ssmResponse.Parameter?.Value ?? '';
    if (!scoutbotQueueUrl) {
      throw new Error('SSM parameter value is empty');
    }
  } catch (error) {
    console.error('Failed to read queue URL from SSM', { queueUrlParam, error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to read queue URL from SSM' }),
    };
  }

  // Determine if this is the production environment (production has "master" in the path)
  const isProduction = queueUrlParam.toLowerCase().includes('master');
  console.log('Starting Scoutbot DLQ monitor', { scoutbotQueueUrl, isProduction });

  try {
    // Step 1: Get main queue and DLQ stats
    const mainQueueStats = await getQueueStats(scoutbotQueueUrl);
    console.log('Main queue stats', mainQueueStats);

    const dlqInfo = await getDlqInfo(scoutbotQueueUrl);
    if (!dlqInfo) {
      console.log('No DLQ configured for Scoutbot queue, exiting');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No DLQ configured' }),
      };
    }

    const dlqStats = await getQueueStats(dlqInfo.url);
    console.log('DLQ stats', { dlqUrl: dlqInfo.url, ...dlqStats });

    // Step 1: Monitor DLQ
    // If DLQ has 1+ messages AND main queue isn't empty, drain main to DLQ
    if (dlqStats.available > 0 && mainQueueStats.available > 0) {
      console.log('DLQ has messages and main queue is not empty - draining main queue to DLQ');
      const drained = await moveMessages({
        sourceUrl: scoutbotQueueUrl,
        destinationUrl: dlqInfo.url,
      });
      console.log(`Drained ${drained} messages from main queue to DLQ`);
    }

    // Refresh stats after potential drain
    const updatedMainStats = await getQueueStats(scoutbotQueueUrl);
    const updatedDlqStats = await getQueueStats(dlqInfo.url);

    // If DLQ is empty, nothing to do
    if (updatedDlqStats.available === 0) {
      console.log('DLQ is empty, nothing to requeue');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'DLQ is empty' }),
      };
    }

    // Step 2: Monitor ECS
    // DLQ has messages, main queue should be empty
    if (updatedMainStats.available > 0 || updatedMainStats.inflight > 0) {
      console.log('Main queue still has messages or in-flight messages, exiting');
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Waiting for main queue to empty',
          mainQueueStats: updatedMainStats,
        }),
      };
    }

    // Check ECS - all Scoutbot task counts should be zero
    const ecsReady = await checkScoutbotEcsIdle(isProduction);
    if (!ecsReady) {
      console.log('Scoutbot ECS services still have running/pending tasks, exiting');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Waiting for ECS tasks to complete' }),
      };
    }

    // Step 3: Requeue messages
    console.log('All conditions met - requeuing messages from DLQ to main queue');
    const requeued = await moveMessages({
      sourceUrl: dlqInfo.url,
      destinationUrl: scoutbotQueueUrl,
    });
    console.log(`Requeued ${requeued} messages from DLQ to main queue`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successfully requeued messages',
        count: requeued,
      }),
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in monitorScoutbotDlq:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: errorMessage }),
    };
  }
};

/**
 * Get queue statistics (available, in-flight, delayed message counts).
 */
async function getQueueStats(queueUrl: string): Promise<QueueStats> {
  const response = await sqsClient.send(
    new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: [
        'ApproximateNumberOfMessages',
        'ApproximateNumberOfMessagesNotVisible',
        'ApproximateNumberOfMessagesDelayed',
      ],
    })
  );

  return {
    available: parseInt(response.Attributes?.ApproximateNumberOfMessages ?? '0', 10),
    inflight: parseInt(response.Attributes?.ApproximateNumberOfMessagesNotVisible ?? '0', 10),
    delayed: parseInt(response.Attributes?.ApproximateNumberOfMessagesDelayed ?? '0', 10),
  };
}

/**
 * Get the DLQ URL from the queue's RedrivePolicy.
 */
async function getDlqInfo(queueUrl: string): Promise<DlqInfo | null> {
  const response = await sqsClient.send(
    new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['RedrivePolicy'],
    })
  );

  const redrivePolicy = response.Attributes?.RedrivePolicy;
  if (!redrivePolicy) {
    return null;
  }

  try {
    const parsed = JSON.parse(redrivePolicy);
    const dlqArn = parsed.deadLetterTargetArn;
    if (!dlqArn) {
      return null;
    }

    // Extract queue name from ARN and get URL
    const queueName = dlqArn.split(':').pop();
    if (!queueName) {
      return null;
    }

    const urlResponse = await sqsClient.send(
      new GetQueueUrlCommand({ QueueName: queueName })
    );

    if (!urlResponse.QueueUrl) {
      return null;
    }

    return {
      arn: dlqArn,
      url: urlResponse.QueueUrl,
    };
  } catch (error) {
    console.error('Failed to parse RedrivePolicy', error);
    return null;
  }
}

/**
 * Check if all Scoutbot ECS services have zero running/pending/desired tasks.
 * Returns true if ECS is idle and safe to requeue messages.
 * @param isProduction - If true, excludes sandbox services. If false, only includes sandbox services.
 */
async function checkScoutbotEcsIdle(isProduction: boolean): Promise<boolean> {
  try {
    // Helper to check if a name/ARN matches the target environment
    // Production has "master" in the name, everything else is dev
    const matchesEnvironment = (name?: string): boolean => {
      if (!name) return false;
      const isMaster = name.toLowerCase().includes('master');
      // In production: only include master. In non-production: exclude master.
      return isProduction ? isMaster : !isMaster;
    };

    // List all clusters
    const listClustersResp = await ecsClient.send(new ListClustersCommand({}));
    const clusterArns = (listClustersResp.clusterArns ?? []).filter((arn) =>
      matchesEnvironment(arn)
    );

    if (!clusterArns.length) {
      console.log('No ECS clusters found for environment', { isProduction });
      return true;
    }

    // Describe clusters to get service info
    const describeClustersResp = await ecsClient.send(
      new DescribeClustersCommand({ clusters: clusterArns })
    );
    const clusters = describeClustersResp.clusters ?? [];

    for (const cluster of clusters) {
      if (!cluster.clusterArn) continue;

      // Filter clusters by environment
      if (!matchesEnvironment(cluster.clusterName) && !matchesEnvironment(cluster.clusterArn)) {
        continue;
      }

      // List services in this cluster
      const listServicesResp = await ecsClient.send(
        new ListServicesCommand({ cluster: cluster.clusterArn })
      );
      const serviceArns = listServicesResp.serviceArns ?? [];

      if (!serviceArns.length) {
        continue;
      }

      // Describe services
      const describeServicesResp = await ecsClient.send(
        new DescribeServicesCommand({
          cluster: cluster.clusterArn,
          services: serviceArns,
        })
      );
      const services = describeServicesResp.services ?? [];

      for (const service of services) {
        // Filter services by environment
        if (!matchesEnvironment(service.serviceArn) && !matchesEnvironment(service.serviceName)) {
          continue;
        }

        // Check if this is a Scoutbot service
        const isScoutbot =
          service.serviceName?.toLowerCase().includes('scoutbot') ||
          service.serviceArn?.toLowerCase().includes('scoutbot') ||
          cluster.clusterName?.toLowerCase().includes('scoutbot');

        if (!isScoutbot) {
          continue;
        }

        console.log('Found Scoutbot service', {
          serviceName: service.serviceName,
          desiredCount: service.desiredCount,
          runningCount: service.runningCount,
          pendingCount: service.pendingCount,
        });

        // Check if any tasks are running or pending
        if (
          (service.desiredCount ?? 0) > 0 ||
          (service.runningCount ?? 0) > 0 ||
          (service.pendingCount ?? 0) > 0
        ) {
          console.log('Scoutbot service has active tasks');
          return false;
        }
      }
    }

    console.log('All Scoutbot ECS services are idle', { isProduction });
    return true;
  } catch (error) {
    console.error('Failed to check ECS status', error);
    // Be conservative - if we can't check, don't proceed
    return false;
  }
}

/**
 * Move all messages from source queue to destination queue.
 * Returns the number of messages moved.
 */
async function moveMessages({
  sourceUrl,
  destinationUrl,
}: {
  sourceUrl: string;
  destinationUrl: string;
}): Promise<number> {
  const fifo = destinationUrl.endsWith('.fifo');
  let moved = 0;
  let idlePolls = 0;

  while (idlePolls < 3) {
    const receive = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: sourceUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 2,
        MessageAttributeNames: ['All'],
        AttributeNames: ['All'],
        VisibilityTimeout: 30,
      })
    );

    const messages = receive.Messages ?? [];
    if (!messages.length) {
      idlePolls += 1;
      continue;
    }
    idlePolls = 0;

    const entries = messages.map((message, index) => {
      const baseId = message.MessageId || `${Date.now()}-${index}`;
      return {
        Id: baseId.slice(0, 80),
        MessageBody: message.Body ?? '',
        MessageAttributes: message.MessageAttributes,
        ...(fifo
          ? {
              MessageGroupId: 'scoutbot-requeue',
              MessageDeduplicationId: `${baseId}-requeue-${Date.now()}`.slice(0, 128),
            }
          : {}),
      };
    });

    const sendResponse = await sqsClient.send(
      new SendMessageBatchCommand({
        QueueUrl: destinationUrl,
        Entries: entries,
      })
    );

    const successIds = new Set((sendResponse.Successful ?? []).map((s) => s.Id));
    const deleteEntries = messages
      .map((message, index) => ({
        Id: entries[index].Id,
        ReceiptHandle: message.ReceiptHandle!,
      }))
      .filter((entry) => successIds.has(entry.Id));

    if (deleteEntries.length) {
      await sqsClient.send(
        new DeleteMessageBatchCommand({
          QueueUrl: sourceUrl,
          Entries: deleteEntries,
        })
      );
      moved += deleteEntries.length;
    }

    if ((sendResponse.Failed?.length ?? 0) > 0) {
      console.warn(
        `Encountered ${sendResponse.Failed?.length} failures while moving messages`
      );
    }
  }

  return moved;
}

