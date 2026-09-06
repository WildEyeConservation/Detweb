import { useEffect } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useMyOrganizations } from './data/memberships';
import { client } from './stores/appClient';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import ButtonGroup from 'react-bootstrap/ButtonGroup';

function OrganizationSelector({
  organization,
  setOrganization,
  allowAutoSelect = true,
}: {
  allowAutoSelect?: boolean;
  organization: {
    id: string;
    name: string;
  };
  setOrganization: (organization: { id: string; name: string }) => void;
}) {
  const { data: myOrganizations } = useMyOrganizations();
  const queries = useQueries({
    queries: myOrganizations
      .filter((membership) => membership.isAdmin)
      .map((membership) => ({
        queryKey: ['organization', membership.organizationId],
        staleTime: 30_000,
        queryFn: async () =>
          (
            await client.models.Organization.get({
              id: membership.organizationId,
            })
          ).data,
      })),
  });
  const organizations = queries.flatMap((query) =>
    query.data ? [query.data] : []
  );
  const onlyOrganization =
    organizations.length === 1 && queries.every((query) => !query.isPending)
      ? organizations[0]
      : undefined;
  useEffect(() => {
    if (allowAutoSelect && !organization.id && onlyOrganization) {
      setOrganization({ id: onlyOrganization.id, name: onlyOrganization.name });
    }
  }, [allowAutoSelect, organization.id, onlyOrganization, setOrganization]);

  if (organizations.length <= 1) {
    return null;
  }

  return (
    <DropdownButton
      as={ButtonGroup}
      key={'Primary'}
      id={`dropdown-variants-Primary`}
      variant={'primary'}
      title={
        organization.id
          ? organizations.find((org) => org.id === organization.id)?.name
          : 'Select an Organisation'
      }
    >
      {organizations?.map((organization) => (
        <Dropdown.Item
          key={organization.id}
          eventKey={organization.id}
          onClick={() => {
            setOrganization({
              id: organization.id,
              name: organization.name,
            });
          }}
        >
          {organization.name}
        </Dropdown.Item>
      ))}
    </DropdownButton>
  );
}

export default OrganizationSelector;
