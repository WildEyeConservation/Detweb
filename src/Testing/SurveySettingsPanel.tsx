import { useState, useEffect, useContext, useMemo } from 'react';
import { Button, Card, Form, Spinner } from 'react-bootstrap';
import Select from 'react-select';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import { GlobalContext, TestingContext } from '../Context';
import { Schema } from '../amplify/client-schema';

type TestType = 'random' | 'interval';
type Option = { label: string; value: string };

type Props = {
  survey: { id: string; name: string };
  preset: { id: string; name: string };
};

export default function SurveySettingsPanel({ survey, preset }: Props) {
  const { client } = useContext(GlobalContext)!;
  const {
    organizationId,
    organizationProjects,
    organizationTestPresets,
  } = useContext(TestingContext)!;

  // Config state
  const [testInterval, setTestInterval] = useState<number>(10);
  const [testType, setTestType] = useState<TestType>('interval');
  const [testChance, setTestChance] = useState<number>(0);
  const [deadzone, setDeadzone] = useState<number>(10);
  const [confirmation, setConfirmation] = useState<boolean>(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

  // Sharing state — other surveys that also use this pool
  const [sharedWith, setSharedWith] = useState<Option[]>([]);
  const [originalSharedWith, setOriginalSharedWith] = useState<Option[]>([]);
  const [sharingLoading, setSharingLoading] = useState(true);
  const [savingShares, setSavingShares] = useState<boolean>(false);

  // Load config
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setConfigLoading(true);
      const { data: config } = await client.models.ProjectTestConfig.get({
        projectId: survey.id,
      });
      if (cancelled) return;
      if (config) {
        setTestType(config.testType as TestType);
        if (config.testType === 'interval') {
          setTestInterval(config.interval ?? 10);
        } else {
          setTestChance(config.random ?? 0);
          setDeadzone(config.deadzone ?? 10);
        }
        setConfirmation(config.postTestConfirmation ?? false);
      }
      setConfigLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [client, survey.id]);

  // Load current shared surveys
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSharingLoading(true);
      const rows: Schema['TestPresetProject']['type'][] = [];
      let nextToken: string | null | undefined = undefined;
      do {
        const page = await client.models.TestPresetProject.list({
          filter: { testPresetId: { eq: preset.id } },
          nextToken,
        });
        rows.push(...(page.data ?? []));
        nextToken = page.nextToken;
      } while (nextToken);
      if (cancelled) return;
      const current = rows
        .filter((r) => r.projectId !== survey.id)
        .map<Option>((r) => {
          const p = organizationProjects.find(
            (op) => op.id === r.projectId
          );
          return { label: p?.name ?? r.projectId, value: r.projectId };
        });
      setSharedWith(current);
      setOriginalSharedWith(current);
      setSharingLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [client, preset.id, survey.id, organizationProjects]);

  const shareOptions = useMemo<Option[]>(() => {
    return organizationProjects
      .filter((p) => !p.hidden && p.id !== survey.id)
      .map((p) => ({ label: p.name, value: p.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [organizationProjects, survey.id]);

  // Also show incoming shares (other pools assigned to this survey)
  const [incomingPools, setIncomingPools] = useState<Option[]>([]);
  const [originalIncomingPools, setOriginalIncomingPools] = useState<Option[]>(
    []
  );
  const [savingIncoming, setSavingIncoming] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: rows } =
        await client.models.TestPresetProject.testPresetsByProjectId({
          projectId: survey.id,
        });
      if (cancelled) return;
      const current = (rows ?? [])
        .filter((r) => r.testPresetId !== preset.id)
        .map<Option>((r) => {
          const pool = organizationTestPresets.find(
            (p) => p.id === r.testPresetId
          );
          return { label: pool?.name ?? r.testPresetId, value: r.testPresetId };
        });
      setIncomingPools(current);
      setOriginalIncomingPools(current);
    })();
    return () => {
      cancelled = true;
    };
  }, [client, survey.id, preset.id, organizationTestPresets]);

  const incomingPoolOptions = useMemo<Option[]>(() => {
    return organizationTestPresets
      .filter((p) => p.id !== preset.id)
      .map((p) => ({ label: p.name, value: p.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [organizationTestPresets, preset.id]);

  async function handleSaveConfig() {
    if (testType === 'interval' && testInterval < 10) {
      alert('Test interval must be greater than 10');
      return;
    }
    if (testType === 'random') {
      if (testChance < 0 || testChance > 100) {
        alert('Test chance must be between 0 and 100');
        return;
      }
      if (deadzone < 10) {
        alert('Deadzone must be greater than 10');
        return;
      }
    }

    setSavingConfig(true);
    await client.models.ProjectTestConfig.update({
      projectId: survey.id,
      testType,
      random: testType === 'random' ? testChance : undefined,
      deadzone: testType === 'random' ? deadzone : undefined,
      interval: testType === 'interval' ? testInterval : undefined,
      postTestConfirmation: confirmation,
    });
    setSavingConfig(false);
  }

  async function handleSaveSharing() {
    setSavingShares(true);
    const toRemove = originalSharedWith.filter(
      (o) => !sharedWith.some((s) => s.value === o.value)
    );
    const toAdd = sharedWith.filter(
      (s) => !originalSharedWith.some((o) => o.value === s.value)
    );

    await Promise.all([
      ...toRemove.map((o) =>
        client.models.TestPresetProject.delete({
          testPresetId: preset.id,
          projectId: o.value,
        })
      ),
      ...toAdd.map((s) =>
        client.models.TestPresetProject.create({
          testPresetId: preset.id,
          projectId: s.value,
          group: organizationId,
        })
      ),
    ]);

    setOriginalSharedWith(sharedWith);
    setSavingShares(false);
  }

  async function handleSaveIncoming() {
    setSavingIncoming(true);
    const toRemove = originalIncomingPools.filter(
      (o) => !incomingPools.some((s) => s.value === o.value)
    );
    const toAdd = incomingPools.filter(
      (s) => !originalIncomingPools.some((o) => o.value === s.value)
    );

    await Promise.all([
      ...toRemove.map((o) =>
        client.models.TestPresetProject.delete({
          testPresetId: o.value,
          projectId: survey.id,
        })
      ),
      ...toAdd.map((s) =>
        client.models.TestPresetProject.create({
          testPresetId: s.value,
          projectId: survey.id,
          group: organizationId,
        })
      ),
    ]);

    setOriginalIncomingPools(incomingPools);
    setSavingIncoming(false);
  }

  const configDirty =
    !configLoading &&
    (savingConfig ? false : true); // always allow save; dirty tracking is nominal here

  const sharingDirty =
    sharedWith.length !== originalSharedWith.length ||
    sharedWith.some((s) => !originalSharedWith.some((o) => o.value === s.value));

  const incomingDirty =
    incomingPools.length !== originalIncomingPools.length ||
    incomingPools.some(
      (s) => !originalIncomingPools.some((o) => o.value === s.value)
    );

  return (
    <div
      className='d-flex flex-column gap-3'
      style={{ maxWidth: 760 }}
    >
      <Card>
        <Card.Header>
          <h5 className='mb-0'>Test Configuration</h5>
        </Card.Header>
        <Card.Body>
          {configLoading ? (
            <div className='d-flex align-items-center gap-2'>
              <Spinner animation='border' size='sm' /> Loading config…
            </div>
          ) : (
            <Form>
              <Form.Group className='mb-2'>
                <Form.Label>Test type</Form.Label>
                <Form.Select
                  value={testType}
                  onChange={(e) => setTestType(e.target.value as TestType)}
                >
                  <option value='random'>Random</option>
                  <option value='interval'>Interval</option>
                </Form.Select>
              </Form.Group>

              {testType === 'interval' && (
                <Form.Group className='mb-2'>
                  <OverlayTrigger
                    placement='right-end'
                    overlay={
                      <Tooltip>
                        User will be tested if they haven't consecutively
                        annotated in the amount of jobs specified. <br /> Note:
                        Navigating to and annotating a previous job will not
                        reset the counter.
                      </Tooltip>
                    }
                    trigger={['hover', 'focus']}
                  >
                    <Form.Label>Test after * unannotated jobs</Form.Label>
                  </OverlayTrigger>
                  <Form.Control
                    type='number'
                    value={testInterval}
                    onChange={(e) =>
                      setTestInterval(parseInt(e.target.value || '10'))
                    }
                    min={10}
                  />
                </Form.Group>
              )}

              {testType === 'random' && (
                <Form.Group className='mb-2'>
                  <OverlayTrigger
                    placement='right-end'
                    overlay={
                      <Tooltip>
                        After the amount of jobs specified in deadzone, each of
                        the following jobs will have the specified probability
                        of being a test.
                      </Tooltip>
                    }
                    trigger={['hover', 'focus']}
                  >
                    <Form.Label>Deadzone</Form.Label>
                  </OverlayTrigger>
                  <Form.Control
                    type='number'
                    value={deadzone}
                    onChange={(e) =>
                      setDeadzone(parseInt(e.target.value || '10'))
                    }
                    min={10}
                    className='mb-2'
                  />
                  <Form.Label>Test probability (%)</Form.Label>
                  <Form.Control
                    type='number'
                    value={testChance}
                    onChange={(e) =>
                      setTestChance(parseInt(e.target.value || '0'))
                    }
                    min={0}
                    max={100}
                  />
                </Form.Group>
              )}

              <Form.Group className='mb-2'>
                <Form.Check
                  type='checkbox'
                  id={`post-test-confirmation-${survey.id}`}
                  label='Post-test confirmation'
                  checked={confirmation}
                  onChange={(e) => setConfirmation(e.target.checked)}
                  className='rounded-checkbox'
                />
              </Form.Group>
            </Form>
          )}
        </Card.Body>
        <Card.Footer className='d-flex justify-content-end'>
          <Button
            variant='primary'
            onClick={handleSaveConfig}
            disabled={configLoading || savingConfig || !configDirty}
          >
            {savingConfig ? 'Saving…' : 'Save config'}
          </Button>
        </Card.Footer>
      </Card>

      <Card>
        <Card.Header>
          <h5 className='mb-0'>Share this pool with other surveys</h5>
        </Card.Header>
        <Card.Body>
          <div
            style={{
              color: 'var(--ss-text-muted)',
              fontSize: 12,
              marginBottom: 8,
            }}
          >
            Surveys you pick here will use <strong>{preset.name}</strong> as
            one of their test pools.
          </div>
          {sharingLoading ? (
            <div className='d-flex align-items-center gap-2'>
              <Spinner animation='border' size='sm' /> Loading…
            </div>
          ) : (
            <Select
              className='text-black'
              isMulti
              value={sharedWith}
              options={shareOptions}
              onChange={(v) => setSharedWith((v as Option[]) ?? [])}
              placeholder='Select surveys…'
              menuPortalTarget={document.body}
              menuPosition='fixed'
              styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
            />
          )}
        </Card.Body>
        <Card.Footer className='d-flex justify-content-end'>
          <Button
            variant='primary'
            onClick={handleSaveSharing}
            disabled={sharingLoading || savingShares || !sharingDirty}
          >
            {savingShares ? 'Saving…' : 'Save sharing'}
          </Button>
        </Card.Footer>
      </Card>

      <Card>
        <Card.Header>
          <h5 className='mb-0'>Also use other pools for this survey</h5>
        </Card.Header>
        <Card.Body>
          <div
            style={{
              color: 'var(--ss-text-muted)',
              fontSize: 12,
              marginBottom: 8,
            }}
          >
            Pick additional pools from other surveys to test users of{' '}
            <strong>{survey.name}</strong> against. This survey's own pool is
            always included.
          </div>
          <Select
            className='text-black'
            isMulti
            value={incomingPools}
            options={incomingPoolOptions}
            onChange={(v) => setIncomingPools((v as Option[]) ?? [])}
            placeholder='Select pools…'
            menuPortalTarget={document.body}
            menuPosition='fixed'
            styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
          />
        </Card.Body>
        <Card.Footer className='d-flex justify-content-end'>
          <Button
            variant='primary'
            onClick={handleSaveIncoming}
            disabled={savingIncoming || !incomingDirty}
          >
            {savingIncoming ? 'Saving…' : 'Save pool usage'}
          </Button>
        </Card.Footer>
      </Card>
    </div>
  );
}
