import { Card, Button } from "react-bootstrap";
import { Tabs, Tab } from "./Tabs";
import Users from "./organization/Users";
import OrganizationSelector from "./OrganizationSelector";
import { useState, useContext, useEffect } from "react";
import Info from "./organization/Info";
import { UserContext, GlobalContext } from "./Context";
import { useOptimisticUpdates } from "./useOptimisticUpdates";
import type { Schema } from "../amplify/data/resource";
import { useQueryClient } from "@tanstack/react-query";

export default function Permissions() {
  const { isOrganizationAdmin } = useContext(UserContext)!;
  const [organization, setOrganization] = useState<{
    id: string;
    name: string;
  }>({ id: "", name: "" });
  const [onClick, setOnClick] = useState<{
    name: string;
    function: () => void;
  } | null>(null);
  const queryClient = useQueryClient();

  if (!isOrganizationAdmin) {
    return <div>You are not authorized to access this page.</div>;
  }

  useEffect(() => {
    if (organization.id) {
      queryClient.invalidateQueries({
        queryKey: ["OrganizationMembership"],
      });
    }
  }, [organization]);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1555px",
        marginTop: "16px",
        marginBottom: "16px",
      }}
    >
      <Card>
        <Card.Header className="d-flex justify-content-between mb-0">
          <Card.Title className="mb-0">
            <h4 className="mb-0">Permissions</h4>
          </Card.Title>
          <OrganizationSelector
            organization={organization}
            setOrganization={setOrganization}
          />
        </Card.Header>
        <Card.Body>
          {organization.id && (
            <PermissionsBody
              key={organization.id}
              organization={organization}
              setOnClick={setOnClick}
            />
          )}
        </Card.Body>
        {onClick && (
          <Card.Footer className="d-flex justify-content-center">
            <Button variant="primary" onClick={onClick.function}>
              {onClick.name}
            </Button>
          </Card.Footer>
        )}
      </Card>
    </div>
  );
}

function PermissionsBody({
  organization,
  setOnClick,
}: {
  organization: { id: string; name: string };
  setOnClick: (onClick: { name: string; function: () => void } | null) => void;
}) {
  const { client } = useContext(GlobalContext)!;

  const membershipHook = useOptimisticUpdates<
    Schema["OrganizationMembership"]["type"],
    "OrganizationMembership"
  >(
    "OrganizationMembership",
    async (nextToken) =>
      client.models.OrganizationMembership.membershipsByOrganizationId({
        organizationId: organization.id,
        nextToken,
      }),
    undefined, // subscriptionFilter (if needed) can go here
    {
      compositeKey: (membership) =>
        `${membership.organizationId}:${membership.userId}`,
    }
  );

  return (
    <Tabs defaultTab={0} onTabChange={() => setOnClick(null)}
    >
      <Tab label="Users">
        <Users
          key={organization.id}
          organization={organization}
          hook={membershipHook}
          setOnClick={setOnClick}
        />
      </Tab>
      <Tab label="Organization Info">
        <Info organizationId={organization.id}/>
      </Tab>
    </Tabs>
  );
}
