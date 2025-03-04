import { Button } from 'react-bootstrap';
import { useContext } from 'react';
import { GlobalContext } from '../Context';
import TestPresetsModal from '../TestPresetsModal';
import ReviewTests from '../ReviewTests';
import { useOptimisticUpdates } from '../useOptimisticUpdates';
import { Schema } from '../../amplify/data/resource';
import { TestingContext } from '../Context';

export default function LocationPools() {
  const { organizationId } = useContext(TestingContext)!;
  const { client, showModal, modalToShow } = useContext(GlobalContext)!;

  const allPresets = useOptimisticUpdates<
    Schema['TestPreset']['type'],
    'TestPreset'
  >(
    'TestPreset',
    async (nextToken) =>
      client.models.TestPreset.testPresetsByOrganizationId({
        organizationId: organizationId,
        nextToken,
      }),
    {
      filter: {
        organizationId: { eq: organizationId },
      },
    }
  );

  return (
    <>
      <div className="d-flex flex-column gap-2 mt-3 w-100">
        <h5 className="mb-0">Location Pools</h5>
        {organizationId && (
          <ReviewTests
            key={organizationId}
            organizationId={organizationId}
            allPresets={allPresets.data}
          />
        )}
        <div className="d-flex justify-content-center mt-2 border-top pt-3 border-secondary">
          <Button
            variant="primary"
            onClick={() => showModal('createLocationPool')}
          >
            Create Location Pool
          </Button>
        </div>
      </div>
      <TestPresetsModal
        show={modalToShow === 'createLocationPool'}
        onClose={() => showModal(null)}
        isNewPreset={true}
        organizationId={organizationId}
      />
    </>
  );
}
