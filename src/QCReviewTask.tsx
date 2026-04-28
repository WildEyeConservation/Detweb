import { useContext, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { GlobalContext, UserContext } from './Context';
import {
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
} from '@aws-sdk/client-sqs';
import { PreloaderFactory } from './Preloader';
import QCAnnotationReview from './QCAnnotationReview';
import { fetchAllPaginatedResults } from './utils';
import { LegendCollapseProvider } from './LegendCollapseContext';

/**
 * QC Review Task — SQS-driven preloader for annotation QC review.
 *
 * Similar to SqsPreloader, but tailored for QC review messages whose body
 * shape is `{ annotation: {...}, queueId: string }` rather than a
 * location reference.
 */
export default function QCReviewTask() {
  const { queueId } = useParams<{ queueId: string }>();
  const { getSqsClient, myMembershipHook } = useContext(UserContext)!;
  const { client } = useContext(GlobalContext)!;
  const [index, setIndex] = useState(0);
  const [queueUrl, setQueueUrl] = useState<string | undefined>(undefined);
  const [annotationSetId, setAnnotationSetId] = useState<string | undefined>(
    undefined
  );
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [group, setGroup] = useState<string | undefined>(undefined);
  const processedRef = useRef<Set<string>>(new Set());

  const [queueZoom, setQueueZoom] = useState<number | null>(null);

  // Fetch queue URL and annotationSetId on mount.
  useEffect(() => {
    if (!queueId) return;
    client.models.Queue.get({ id: queueId }).then(({ data }) => {
      if (data?.url) setQueueUrl(data.url as string);
      if (data?.annotationSetId) setAnnotationSetId(data.annotationSetId);
      if (data?.projectId) setProjectId(data.projectId);
      if (data?.group) setGroup(data.group);
      if (data?.zoom != null) setQueueZoom(data.zoom);
    });
  }, [queueId, client]);

  // Fetch categories for this annotation set (needed by the review component).
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string; shortcutKey: string | null }>
  >([]);

  useEffect(() => {
    if (!annotationSetId) return;
    let mounted = true;
    fetchAllPaginatedResults(
      client.models.Category.categoriesByAnnotationSetId,
      {
        annotationSetId,
        selectionSet: ['id', 'name', 'shortcutKey'] as const,
      }
    ).then((cats) => {
      if (!mounted) return;
      setCategories(
        cats.map((c: any) => ({
          id: c.id,
          name: c.name,
          shortcutKey: c.shortcutKey ?? null,
        }))
      );
    });
    return () => {
      mounted = false;
    };
  }, [annotationSetId, client]);

  const fetcher = useCallback(async () => {
    while (true) {
      if (!queueUrl) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      const sqsClient = await getSqsClient();
      const response = await sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 1,
          MessageAttributeNames: ['All'],
          VisibilityTimeout: 600,
        })
      );

      if (response.Messages) {
        const entity = response.Messages[0];
        const body = JSON.parse(entity.Body!);
        body.message_id = crypto.randomUUID();

        // Deduplication by annotation ID.
        const annotationId = body.annotation?.id;
        if (annotationId && processedRef.current.has(annotationId)) {
          try {
            const sqsClient2 = await getSqsClient();
            await sqsClient2.send(
              new DeleteMessageCommand({
                QueueUrl: queueUrl,
                ReceiptHandle: entity.ReceiptHandle,
              })
            );
          } catch {
            // ignore
          }
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }

        if (annotationId) {
          processedRef.current.add(annotationId);
        }

        body.ack = async () => {
          try {
            const sqsClient2 = await getSqsClient();
            await sqsClient2.send(
              new DeleteMessageCommand({
                QueueUrl: queueUrl,
                ReceiptHandle: entity.ReceiptHandle,
              })
            );
          } catch {
            console.log(
              `QC ack failed for annotation ${annotationId} with receipthandle ${entity.ReceiptHandle}`
            );
          }
        };

        return body;
      } else {
        // No messages — wait and retry.
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }, [queueUrl, getSqsClient]);

  // Poll SQS for approximate remaining messages.
  const [jobsRemaining, setJobsRemaining] = useState<string>('Unknown');

  useEffect(() => {
    if (!queueUrl) return;
    const updateJobs = async () => {
      try {
        const sqsClient = await getSqsClient();
        const result = await sqsClient.send(
          new GetQueueAttributesCommand({
            QueueUrl: queueUrl,
            AttributeNames: ['ApproximateNumberOfMessages'],
          })
        );
        setJobsRemaining(
          result.Attributes?.ApproximateNumberOfMessages || 'Unknown'
        );
      } catch {
        // ignore polling errors
      }
    };
    updateJobs();
    const interval = setInterval(updateJobs, 10000);
    return () => clearInterval(interval);
  }, [queueUrl, getSqsClient]);

  const Preloader = useMemo(() => PreloaderFactory(QCAnnotationReview), []);

  return (
    <LegendCollapseProvider>
      <div
        className='d-flex flex-column align-items-center gap-3 w-100 h-100'
        style={{ paddingTop: '12px', paddingBottom: '12px' }}
      >
        <div className='w-100 h-100'>
          {queueUrl && categories.length > 0 ? (
            <Preloader
              index={index}
              setIndex={setIndex}
              fetcher={fetcher}
              visible={true}
              preloadN={3}
              historyN={2}
              categories={categories}
              setCategories={setCategories}
              projectId={projectId}
              annotationSetId={annotationSetId}
              group={group}
              queueId={queueId}
              queueZoom={queueZoom}
              setQueueZoom={setQueueZoom}
              adminMemberships={myMembershipHook.data
                ?.filter((membership: any) => membership.isAdmin)
                .map((membership: any) => ({
                  projectId: membership.projectId,
                  queueId: membership.queueId!,
                }))}
            />
          ) : (
            <div className='d-flex justify-content-center align-items-center h-100'>
              <div className='text-muted'>Loading QC review queue...</div>
            </div>
          )}
        </div>
        <div
          className='d-flex flex-row align-items-center justify-content-center gap-3 w-100 flex-wrap'
          style={{
            background: 'var(--ss-surface)',
            border: '1.5px solid var(--ss-border)',
            borderRadius: 10,
            padding: '10px 16px',
            boxShadow: '0 1px 2px rgba(28, 28, 26, 0.03)',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <span>
            <strong style={{ color: 'var(--ss-text)', fontWeight: 700 }}>
              {jobsRemaining}
            </strong>{' '}
            <span style={{ color: 'var(--ss-text-muted)' }}>
              jobs remaining (globally)
            </span>
          </span>
          <span
            className='d-none d-sm-inline'
            style={{ color: 'var(--ss-border-strong)' }}
          >
            |
          </span>
          <span>
            <strong style={{ color: 'var(--ss-text)', fontWeight: 700 }}>
              {index}
            </strong>{' '}
            <span style={{ color: 'var(--ss-text-muted)' }}>
              jobs completed in this session
            </span>
          </span>
        </div>
      </div>
    </LegendCollapseProvider>
  );
}
