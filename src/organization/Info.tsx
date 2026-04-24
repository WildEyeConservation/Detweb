import { useEffect, useState, useContext } from 'react';
import { GlobalContext } from '../Context';
import { Schema } from '../amplify/client-schema';
import { Info as InfoIcon } from 'lucide-react';
import Spinner from 'react-bootstrap/Spinner';

export default function Info({ organizationId }: { organizationId: string }) {
  const { client } = useContext(GlobalContext);

  const [organization, setOrganization] = useState<
    Schema['Organization']['type'] | null
  >(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchOrganization = async () => {
      setLoading(true);
      const { data } = await client.models.Organization.get({
        id: organizationId!,
      });
      setOrganization(data);
      setLoading(false);
    };

    fetchOrganization();
  }, [organizationId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spinner animation='border' />
      </div>
    );
  }

  const labelStyle = {
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: 'var(--ss-text-dim)',
    fontWeight: 600,
    marginBottom: 6,
  };

  return (
    <div
      style={{
        maxWidth: 800,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div className='ss-card'>
        <div style={{ marginBottom: 20 }}>
          <div style={labelStyle}>Organisation Name</div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--ss-text)',
              letterSpacing: '-0.02em',
            }}
          >
            {organization?.name || '---'}
          </div>
        </div>
        <div>
          <div style={labelStyle}>Description</div>
          <p
            style={{
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
              fontSize: 14,
              color: 'var(--ss-text)',
              margin: 0,
            }}
          >
            {organization?.description || 'No description provided.'}
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: 14,
          borderRadius: 8,
          background: 'var(--ss-blue-soft)',
          border: '1px solid #bfd7ef',
        }}
      >
        <InfoIcon
          size={18}
          style={{
            color: 'var(--ss-blue)',
            marginTop: 2,
            flexShrink: 0,
          }}
        />
        <div style={{ fontSize: 13, color: 'var(--ss-text)' }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            Want to update your organisation details?
          </div>
          <div style={{ color: 'var(--ss-text-muted)' }}>
            Please contact <strong>WildEye support</strong> if you would like to
            make changes to this information.
          </div>
        </div>
      </div>
    </div>
  );
}
