import { useContext, useEffect, useState } from 'react';
import { GlobalContext, UserContext } from './Context';
import { Schema } from '../amplify/data/resource';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import ButtonGroup from 'react-bootstrap/ButtonGroup';

function OrganizationSelector({
  organization,
  setOrganization,
}: {
  organization: {
    id: string;
    name: string;
  };
  setOrganization: (organization: { id: string; name: string }) => void;
}) {
  const { client } = useContext(GlobalContext)!;
  const {
    myOrganizationHook: { data: myOrganizations },
  } = useContext(UserContext)!;
  const [organizations, setOrganizations] = useState<
    Schema['Organization']['type'][]
  >([]);

  useEffect(() => {
    Promise.all(
      myOrganizations
        ?.filter((membership) => membership.isAdmin)
        .map(
          async (membership) =>
            (
              await client.models.Organization.get({
                id: membership.organizationId,
              })
            ).data
        )
    ).then((allOrganizations) => {
      setOrganizations(
        allOrganizations.filter((organization) => organization !== null)
      );

      if (allOrganizations.length === 1 && allOrganizations[0]?.id) {
        setOrganization({
          id: allOrganizations[0].id,
          name: allOrganizations[0].name,
        });
      }
    });
  }, [myOrganizations]);

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
          : 'Select an Organization'
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
