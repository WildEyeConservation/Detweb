import { useContext, useEffect, useState } from 'react';
import { GlobalContext, UserContext } from './Context';
import { Schema } from '../amplify/data/resource';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import NavDropdown from 'react-bootstrap/NavDropdown';

function OrganizationSelector() {
  const { client } = useContext(GlobalContext)!;
  const {
    myOrganizationHook: { data: myOrganizations },
  } = useContext(UserContext)!;
  const [organizations, setOrganizations] = useState<
    Schema['Organization']['type'][]
  >([]);
  const { organizationId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

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

      if (
        allOrganizations.length === 1 &&
        (location.pathname === `/manage-organization` ||
          location.pathname === `/manage-organization/`) &&
        allOrganizations[0]?.id
      ) {
        navigate(`/manage-organization/${allOrganizations[0].id}/users`);
      }
    });
  }, [myOrganizations]);

  return (
    <>
      {
        <NavDropdown
          title={
            organizationId
              ? organizations.find((org) => org.id === organizationId)?.name
              : 'Select an Organization'
          }
          id="organization-nav-dropdown"
          onSelect={(orgId) => {
            if (orgId) {
              navigate(`/manage-organization/${orgId}/users`);
            }
          }}
        >
          {!organizationId && (
            <NavDropdown.Item key="none" disabled>
              Select an Organization
            </NavDropdown.Item>
          )}
          {organizations?.map((organization) => (
            <NavDropdown.Item
              key={organization.id}
              eventKey={organization.id}
              active={organizationId === organization.id}
            >
              {organization.name}
            </NavDropdown.Item>
          ))}
        </NavDropdown>
      }
    </>
  );
}

export default OrganizationSelector;
