import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Spinner, Table } from 'react-bootstrap';
import {
  DeleteMessageBatchCommand,
  GetQueueAttributesCommand,
  GetQueueUrlCommand,
  ReceiveMessageCommand,
  SendMessageBatchCommand,
  type SQSClient,
} from '@aws-sdk/client-sqs';
import {
  DescribeClustersCommand,
  DescribeServicesCommand,
  ECSClient,
  ListClustersCommand,
  ListServicesCommand,
  type Cluster,
  type Service,
} from '@aws-sdk/client-ecs';
import { fetchAuthSession } from 'aws-amplify/auth';
import { GlobalContext, UserContext } from './Context';
import type { Schema } from './amplify/client-schema';

type MaybeNumber = number | null;

type DlqSummary = {
  arn: string;
  name: string;
  url?: string;
  available: MaybeNumber;
  inflight: MaybeNumber;
  delayed: MaybeNumber;
};

type EcsClusterSummary = {
  clusterArn: string;
  name: string;
  status?: string;
  runningTasksCount?: number;
  pendingTasksCount?: number;
  activeServicesCount?: number;
  services: {
    serviceArn?: string;
    name?: string;
    status?: string;
    desiredCount?: number;
    runningCount?: number;
    pendingCount?: number;
  }[];
};

type QueueDescriptor = {
  id: string;
  label: string;
  url?: string | null;
  scope: 'project' | 'system';
  projectName?: string | null;
};

type QueueHealthRow = {
  id: string;
  label: string;
  url?: string | null;
  arn?: string;
  available: MaybeNumber;
  inflight: MaybeNumber;
  delayed: MaybeNumber;
  dlq?: DlqSummary;
  error?: string | null;
  scope: QueueDescriptor['scope'];
  projectName?: string | null;
};

const NUMBER_ATTRIBUTES = [
  'ApproximateNumberOfMessages',
  'ApproximateNumberOfMessagesNotVisible',
  'ApproximateNumberOfMessagesDelayed',
] as const;

const parseNumberAttr = (value?: string): number => {
  const parsed = parseInt(value ?? '0', 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatCount = (value: MaybeNumber): string =>
  value === null || value === undefined ? '—' : value.toLocaleString();

const formatSystemQueueLabel = (key: string): string => {
  const withoutSuffix = key.replace(/QueueUrl$/i, '');
  const spaced = withoutSuffix
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

export default function AwsServiceHealth() {
  const user = useContext(UserContext);
  const global = useContext(GlobalContext);

  const client = global?.client;
  const getSqsClient = user?.getSqsClient;

  const [rows, setRows] = useState<QueueHealthRow[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    variant: 'success' | 'danger';
    message: string;
  } | null>(null);
  const [actionState, setActionState] = useState<
    Record<string, 'drain' | 'replay' | undefined>
  >({});
  const [ecsState, setEcsState] = useState<{
    clusters: EcsClusterSummary[];
    isLoading: boolean;
    error: string | null;
  }>({
    clusters: [],
    isLoading: false,
    error: null,
  });

  const contextsReady = Boolean(client && user && getSqsClient);

  const fetchEcsStatus = useCallback(async () => {
    if (!global?.region) return;
    setEcsState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const { credentials } = await fetchAuthSession();
      const ecsClient = new ECSClient({
        region: global.region,
        credentials,
      });

      const listClustersResp = await ecsClient.send(
        new ListClustersCommand({})
      );
      const clusterArns = (listClustersResp.clusterArns ?? []).filter(
        (arn) => !arn?.toLowerCase().includes('sand')
      );
      if (!clusterArns.length) {
        setEcsState({ clusters: [], isLoading: false, error: null });
        return;
      }

      const describeClustersResp = await ecsClient.send(
        new DescribeClustersCommand({ clusters: clusterArns })
      );
      const clusters = describeClustersResp.clusters ?? [];

      const summaries: EcsClusterSummary[] = [];

      for (const cluster of clusters) {
        if (!cluster.clusterArn) continue;
        const services = await fetchClusterServices(ecsClient, cluster);
        summaries.push({
          clusterArn: cluster.clusterArn,
          name: extractName(cluster.clusterArn),
          status: cluster.status,
          runningTasksCount: cluster.runningTasksCount,
          pendingTasksCount: cluster.pendingTasksCount,
          activeServicesCount: cluster.activeServicesCount,
          services,
        });
      }

      setEcsState({ clusters: summaries, isLoading: false, error: null });
    } catch (err) {
      console.error('Failed to fetch ECS status', err);
      setEcsState({
        clusters: [],
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unable to load ECS data.',
      });
    }
  }, [global?.region]);

  const systemQueues = useMemo<QueueDescriptor[]>(() => {
    const custom = global?.backend?.custom;
    if (!custom) {
      return [];
    }
    return Object.entries(custom)
      .filter(
        ([key, value]) =>
          /queueurl$/i.test(key) && typeof value === 'string' && value.length
      )
      .map(([key, value]) => ({
        id: `system-${key}`,
        label: formatSystemQueueLabel(key),
        url: value,
        scope: 'system' as const,
      }));
  }, [global?.backend?.custom]);

  type QueueWithProject = Schema['Queue']['type'] & {
    project?: { name?: string | null } | null;
  };

  const listAllQueues = useCallback(async () => {
    if (!client) {
      return [];
    }
    let nextToken: string | undefined;
    const allQueues: QueueWithProject[] = [];
    do {
      const response = await client.models.Queue.list({
        limit: 200,
        nextToken,
        selectionSet: [
          'id',
          'name',
          'tag',
          'url',
          'projectId',
          'project.name',
        ],
      });
      if (response?.data) {
        allQueues.push(...(response.data as QueueWithProject[]));
      }
      nextToken = response?.nextToken ?? undefined;
    } while (nextToken);
    return allQueues;
  }, [client]);

  const buildDlqSummary = useCallback(
    async (arn: string, sqsClient: SQSClient) => {
      const queueName = arn.split(':').pop() ?? arn;
      let url: string | undefined;
      try {
        const urlResult = await sqsClient.send(
          new GetQueueUrlCommand({ QueueName: queueName })
        );
        url = urlResult.QueueUrl;
      } catch (error) {
        console.error('Unable to resolve DLQ URL', { arn, error });
      }

      if (!url) {
        return {
          arn,
          name: queueName,
          available: null,
          inflight: null,
          delayed: null,
        };
      }

      try {
        const attributes = await sqsClient.send(
          new GetQueueAttributesCommand({
            QueueUrl: url,
            AttributeNames: [...NUMBER_ATTRIBUTES, 'QueueArn'],
          })
        );
        return {
          arn: attributes.Attributes?.QueueArn ?? arn,
          name: queueName,
          url,
          available: parseNumberAttr(
            attributes.Attributes?.ApproximateNumberOfMessages
          ),
          inflight: parseNumberAttr(
            attributes.Attributes?.ApproximateNumberOfMessagesNotVisible
          ),
          delayed: parseNumberAttr(
            attributes.Attributes?.ApproximateNumberOfMessagesDelayed
          ),
        };
      } catch (error) {
        console.error('Unable to describe DLQ attributes', { arn, error });
        return {
          arn,
          name: queueName,
          url,
          available: null,
          inflight: null,
          delayed: null,
        };
      }
    },
    []
  );

  const fetchQueueHealth = useCallback(async () => {
    if (!contextsReady || !getSqsClient || !client) {
      return;
    }

    setIsRefreshing(true);
    setFetchError(null);

    try {
      const [queues, sqsClient] = await Promise.all([
        listAllQueues(),
        getSqsClient(),
      ]);

      const descriptors: QueueDescriptor[] = [
        ...queues.map((queue) => ({
          id: queue.id,
          label: queue.tag || queue.name,
          url: queue.url,
          scope: 'project' as const,
          projectName: queue.project?.name || queue.projectId || null,
        })),
        ...systemQueues,
      ];

      const uniqueDescriptors = descriptors.filter(
        (descriptor, idx, arr) =>
          arr.findIndex((d) => d.id === descriptor.id) === idx
      );

      if (!uniqueDescriptors.length) {
        setRows([]);
        return;
      }

      const queueRows = await Promise.all(
        uniqueDescriptors.map(async (descriptor): Promise<QueueHealthRow> => {
          if (!descriptor.url) {
            return {
              id: descriptor.id,
              label: descriptor.label,
              url: descriptor.url,
              scope: descriptor.scope,
              projectName: descriptor.projectName,
              available: null,
              inflight: null,
              delayed: null,
              error: 'Queue does not have an SQS URL configured.',
            };
          }

          try {
            const attributes = await sqsClient.send(
              new GetQueueAttributesCommand({
                QueueUrl: descriptor.url,
                AttributeNames: [
                  ...NUMBER_ATTRIBUTES,
                  'RedrivePolicy',
                  'QueueArn',
                ],
              })
            );

            let dlqSummary: DlqSummary | undefined;
            const redrivePolicy = attributes.Attributes?.RedrivePolicy;
            if (redrivePolicy) {
              try {
                const parsed = JSON.parse(redrivePolicy);
                if (parsed.deadLetterTargetArn) {
                  dlqSummary = await buildDlqSummary(
                    parsed.deadLetterTargetArn,
                    sqsClient
                  );
                }
              } catch (error) {
                console.error('Unable to parse redrive policy', {
                  queueId: descriptor.id,
                  redrivePolicy,
                  error,
                });
              }
            }

            return {
              id: descriptor.id,
              label: descriptor.label,
              url: descriptor.url,
              arn: attributes.Attributes?.QueueArn ?? undefined,
              available: parseNumberAttr(
                attributes.Attributes?.ApproximateNumberOfMessages
              ),
              inflight: parseNumberAttr(
                attributes.Attributes?.ApproximateNumberOfMessagesNotVisible
              ),
              delayed: parseNumberAttr(
                attributes.Attributes?.ApproximateNumberOfMessagesDelayed
              ),
              dlq: dlqSummary,
              scope: descriptor.scope,
              projectName: descriptor.projectName,
            };
          } catch (error) {
            console.error('Unable to describe queue attributes', {
              queueId: descriptor.id,
              error,
            });
            const message =
              error instanceof Error ? error.message : 'Unknown error';
            return {
              id: descriptor.id,
              label: descriptor.label,
              url: descriptor.url,
              available: null,
              inflight: null,
              delayed: null,
              error: message,
              scope: descriptor.scope,
              projectName: descriptor.projectName,
            };
          }
        })
      );

      setRows(queueRows.sort((a, b) => a.label.localeCompare(b.label)));
    } catch (error) {
      console.error('Failed to refresh queue health', error);
      const message =
        error instanceof Error ? error.message : 'Unable to refresh queues.';
      setFetchError(message);
    } finally {
      setIsRefreshing(false);
    }
  }, [
    buildDlqSummary,
    client,
    contextsReady,
    getSqsClient,
    listAllQueues,
    systemQueues,
  ]);

  useEffect(() => {
    fetchQueueHealth();
    const interval = setInterval(fetchQueueHealth, 60000);
    return () => clearInterval(interval);
  }, [fetchQueueHealth]);

  useEffect(() => {
    fetchEcsStatus();
    const interval = setInterval(fetchEcsStatus, 120000);
    return () => clearInterval(interval);
  }, [fetchEcsStatus]);

  const rowsById = useMemo(() => {
    return rows.reduce<Record<string, QueueHealthRow>>((acc, row) => {
      acc[row.id] = row;
      return acc;
    }, {});
  }, [rows]);

  const groupedRows = useMemo(() => {
    return {
      project: rows.filter((row) => row.scope === 'project'),
      system: rows.filter((row) => row.scope === 'system'),
    };
  }, [rows]);

  const handleDrainToDlq = useCallback(
    async (queueId: string) => {
      const row = rowsById[queueId];
      if (!row?.url || !row.dlq?.url || !getSqsClient) {
        setFeedback({
          variant: 'danger',
          message: 'Queue or DLQ URL is missing.',
        });
        return;
      }

      setActionState((prev) => ({ ...prev, [queueId]: 'drain' }));
      setFeedback(null);
      try {
        const sqsClient = await getSqsClient();
        const moved = await moveMessages({
          sqsClient,
          sourceUrl: row.url,
          destinationUrl: row.dlq.url,
          direction: 'drain',
        });
        setFeedback({
          variant: 'success',
          message:
            moved > 0
              ? `Moved ${moved} message${moved === 1 ? '' : 's'} from ${row.label
              } to ${row.dlq.name}.`
              : `No messages found in ${row.label}.`,
        });
        await fetchQueueHealth();
      } catch (error) {
        console.error('Unable to drain queue', { queueId, error });
        const message =
          error instanceof Error ? error.message : 'Unable to drain queue.';
        setFeedback({ variant: 'danger', message });
      } finally {
        setActionState((prev) => ({ ...prev, [queueId]: undefined }));
      }
    },
    [fetchQueueHealth, getSqsClient, rowsById]
  );

  const handleReplayFromDlq = useCallback(
    async (queueId: string) => {
      const row = rowsById[queueId];
      if (!row?.url || !row.dlq?.url || !getSqsClient) {
        setFeedback({
          variant: 'danger',
          message: 'Queue or DLQ URL is missing.',
        });
        return;
      }

      setActionState((prev) => ({ ...prev, [queueId]: 'replay' }));
      setFeedback(null);
      try {
        const sqsClient = await getSqsClient();
        const moved = await moveMessages({
          sqsClient,
          sourceUrl: row.dlq.url,
          destinationUrl: row.url,
          direction: 'replay',
        });
        setFeedback({
          variant: 'success',
          message:
            moved > 0
              ? `Moved ${moved} message${moved === 1 ? '' : 's'} from ${row.dlq.name
              } back to ${row.label}.`
              : `No messages found in ${row.dlq.name}.`,
        });
        await fetchQueueHealth();
      } catch (error) {
        console.error('Unable to replay DLQ', { queueId, error });
        const message =
          error instanceof Error ? error.message : 'Unable to replay DLQ.';
        setFeedback({ variant: 'danger', message });
      } finally {
        setActionState((prev) => ({ ...prev, [queueId]: undefined }));
      }
    },
    [fetchQueueHealth, getSqsClient, rowsById]
  );

  if (!contextsReady) {
    return (
      <Card className='mt-3'>
        <Card.Body>
          <Alert variant='warning' className='mb-0'>
            Unable to load AWS service health because admin data has not beenI
            initialised.
          </Alert>
        </Card.Body>
      </Card>
    );
  }

  return (
    <div className='d-flex flex-column gap-4 mt-3'>
      <Card>
        <Card.Header className='d-flex justify-content-between align-items-center'>
          <div>
            <Card.Title className='mb-0'>Queue Health</Card.Title>
            <div className='text-muted small'>
              Monitor message backlog and dead-letter queues.
            </div>
          </div>
          <Button
            variant='outline-primary'
            onClick={fetchQueueHealth}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <Spinner animation='border' size='sm' className='me-2' />
                Refreshing
              </>
            ) : (
              'Refresh'
            )}
          </Button>
        </Card.Header>
        <Card.Body>
          {fetchError && (
            <Alert variant='danger'>
              Failed to refresh queue metrics: {fetchError}
            </Alert>
          )}
          {feedback && (
            <Alert
              variant={feedback.variant === 'success' ? 'success' : 'danger'}
              onClose={() => setFeedback(null)}
              dismissible
            >
              {feedback.message}
            </Alert>
          )}
          {!rows.length && (
            <Alert variant='info'>No queues are currently configured.</Alert>
          )}
          {rows.length > 0 && (
            <div className='d-flex flex-column gap-4'>
              {groupedRows.system.length > 0 && (
                <QueueTable
                  title='System Queues'
                  rows={groupedRows.system}
                  actionState={actionState}
                  onDrain={handleDrainToDlq}
                  onReplay={handleReplayFromDlq}
                />
              )}
              {groupedRows.project.length > 0 && (
                <QueueTable
                  title='Project Queues'
                  rows={groupedRows.project}
                  actionState={actionState}
                  onDrain={handleDrainToDlq}
                  onReplay={handleReplayFromDlq}
                />
              )}
            </div>
          )}
        </Card.Body>
      </Card>

      <Card>
        <Card.Header className='d-flex justify-content-between align-items-center'>
          <div>
            <Card.Title className='mb-0'>ECS Services</Card.Title>
            <div className='text-muted small'>
              Clusters and services currently running in ECS.
            </div>
          </div>
          <Button
            variant='outline-primary'
            onClick={fetchEcsStatus}
            disabled={ecsState.isLoading}
          >
            {ecsState.isLoading ? (
              <>
                <Spinner animation='border' size='sm' className='me-2' />
                Refreshing
              </>
            ) : (
              'Refresh'
            )}
          </Button>
        </Card.Header>
        <Card.Body>
          {ecsState.error && (
            <Alert variant='danger' className='mb-3'>
              {ecsState.error}
            </Alert>
          )}

          {ecsState.isLoading && !ecsState.clusters.length ? (
            <div className='d-flex justify-content-center py-4'>
              <Spinner animation='border' />
            </div>
          ) : ecsState.clusters.length === 0 ? (
            <Alert variant='info'>No ECS clusters found.</Alert>
          ) : (
            <div className='d-flex flex-column gap-3'>
              {ecsState.clusters.map((cluster) => (
                <Card key={cluster.clusterArn} className='border'>
                  <Card.Header className='d-flex justify-content-between align-items-center'>
                    <div>
                      <strong>{cluster.name}</strong>
                      <div className='text-muted small'>{cluster.clusterArn}</div>
                    </div>
                    <div className='d-flex align-items-center gap-3'>
                      <Badge bg='success'>
                        Running Tasks: {cluster.runningTasksCount ?? 0}
                      </Badge>
                      <Badge bg='warning' text='dark'>
                        Pending Tasks: {cluster.pendingTasksCount ?? 0}
                      </Badge>
                      <Badge bg='secondary'>
                        Services: {cluster.activeServicesCount ?? 0}
                      </Badge>
                    </div>
                  </Card.Header>
                  <Card.Body>
                    {cluster.services.length === 0 ? (
                      <div className='text-muted'>No services in this cluster.</div>
                    ) : (
                      <div className='table-responsive'>
                        <Table hover size='sm' className='align-middle mb-0'>
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Status</th>
                              <th className='text-end'>Desired</th>
                              <th className='text-end'>Running</th>
                              <th className='text-end'>Pending</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cluster.services.map((service) => (
                              <tr key={service.serviceArn}>
                                <td>{service.name || extractName(service.serviceArn || '')}</td>
                                <td>{service.status || '—'}</td>
                                <td className='text-end'>
                                  {service.desiredCount ?? '—'}
                                </td>
                                <td className='text-end'>
                                  {service.runningCount ?? '—'}
                                </td>
                                <td className='text-end'>
                                  {service.pendingCount ?? '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              ))}
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}

function QueueTable({
  title,
  rows,
  actionState,
  onDrain,
  onReplay,
}: {
  title: string;
  rows: QueueHealthRow[];
  actionState: Record<string, 'drain' | 'replay' | undefined>;
  onDrain: (id: string) => void;
  onReplay: (id: string) => void;
}) {
  return (
    <div>
      <h5 className='mb-3'>{title}</h5>
      <div className='table-responsive'>
        <Table hover responsive className='align-middle'>
          <thead>
            <tr>
              <th>Queue</th>
              <th className='text-end'>Messages</th>
              <th className='text-end'>In Flight</th>
              <th className='text-end'>Delayed</th>
              <th>Dead Letter Queue</th>
              <th className='text-end'>DLQ Messages</th>
              <th className='text-end'>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const currentAction = actionState[row.id];
              const canDrain = !!row.dlq && !!row.arn;
              const canReplay =
                !!row.dlq && !!row.arn && (row.dlq.available ?? 0) > 0;

              return (
                <tr key={row.id}>
                  <td>
                    <div className='fw-semibold'>{row.label}</div>
                    <div>
                      <Badge bg={row.scope === 'system' ? 'info' : 'primary'}>
                        {row.scope === 'system'
                          ? 'System queue'
                          : 'Project queue'}
                      </Badge>
                    </div>
                    <div className='text-muted small'>
                      {row.url || 'No queue URL configured.'}
                    </div>
                    {row.scope === 'project' && row.projectName && (
                      <div className='text-muted small'>
                        Project: {row.projectName}
                      </div>
                    )}
                    {row.error && (
                      <div className='text-danger small mt-1'>{row.error}</div>
                    )}
                  </td>
                  <td className='text-end'>{formatCount(row.available)}</td>
                  <td className='text-end'>{formatCount(row.inflight)}</td>
                  <td className='text-end'>{formatCount(row.delayed)}</td>
                  <td>
                    {row.dlq ? (
                      <>
                        <div className='fw-semibold'>{row.dlq.name}</div>
                        <div className='text-muted small'>
                          {row.dlq.url || 'URL unavailable'}
                        </div>
                      </>
                    ) : (
                      <Badge bg='secondary'>No DLQ configured</Badge>
                    )}
                  </td>
                  <td className='text-end'>
                    {row.dlq ? formatCount(row.dlq.available) : '—'}
                  </td>
                  <td>
                    <div className='d-flex justify-content-end gap-2'>
                      <Button
                        size='sm'
                        variant='outline-warning'
                        disabled={!canDrain || currentAction === 'replay'}
                        onClick={() => onDrain(row.id)}
                      >
                        {currentAction === 'drain' ? (
                          <Spinner animation='border' size='sm' />
                        ) : (
                          'Drain to DLQ'
                        )}
                      </Button>
                      <Button
                        size='sm'
                        variant='outline-success'
                        disabled={!canReplay || currentAction === 'drain'}
                        onClick={() => onReplay(row.id)}
                      >
                        {currentAction === 'replay' ? (
                          <Spinner animation='border' size='sm' />
                        ) : (
                          'Replay DLQ'
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

async function moveMessages({
  sqsClient,
  sourceUrl,
  destinationUrl,
  direction,
}: {
  sqsClient: SQSClient;
  sourceUrl: string;
  destinationUrl: string;
  direction: 'drain' | 'replay';
}) {
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
            MessageGroupId: direction === 'drain' ? 'drain' : 'replay',
            MessageDeduplicationId:
              `${baseId}-${direction}-${Date.now()}`.slice(0, 128),
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

    const successIds = new Set(
      (sendResponse.Successful ?? []).map((s) => s.Id)
    );
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
        `Encountered ${sendResponse.Failed?.length} failures while moving messages from ${sourceUrl} to ${destinationUrl}`
      );
    }
  }

  return moved;
}

async function fetchClusterServices(
  ecsClient: ECSClient,
  cluster: Cluster
): Promise<EcsClusterSummary['services']> {
  if (!cluster.clusterArn) {
    return [];
  }
  const listServicesResp = await ecsClient.send(
    new ListServicesCommand({
      cluster: cluster.clusterArn,
    })
  );
  const serviceArns = listServicesResp.serviceArns ?? [];
  if (!serviceArns.length) {
    return [];
  }
  const describeServicesResp = await ecsClient.send(
    new DescribeServicesCommand({
      cluster: cluster.clusterArn,
      services: serviceArns,
    })
  );
  const services = describeServicesResp.services ?? [];
  return services
    .filter(
      (service) =>
        !service.serviceArn?.toLowerCase().includes('sand') &&
        !service.serviceName?.toLowerCase().includes('sand')
    )
    .map((service: Service) => ({
      serviceArn: service.serviceArn,
      name: service.serviceName,
      status: service.status,
      desiredCount: service.desiredCount,
      runningCount: service.runningCount,
      pendingCount: service.pendingCount,
    }));
}

function extractName(arn: string): string {
  if (!arn) return 'Unknown';
  const parts = arn.split('/');
  return parts[parts.length - 1] || arn;
}
