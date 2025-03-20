import { Card } from "react-bootstrap";
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
        <Card.Body>
          <div className="d-flex justify-content-between mb-0">
            <Card.Title className="mb-0">
              <h4 className="mb-3">Permissions</h4>
            </Card.Title>
            <OrganizationSelector
              organization={organization}
              setOrganization={setOrganization}
            />
          </div>
          {organization.id && (
            <PermissionsBody
              key={organization.id}
              organization={organization}
            />
          )}
        </Card.Body>
      </Card>
    </div>
  );
}

function PermissionsBody({
  organization,
}: {
  organization: { id: string; name: string };
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
    <Tabs defaultTab={0}>
      <Tab label="Users">
        <Users
          key={organization.id}
          organization={organization}
          hook={membershipHook}
        />
      </Tab>
      <Tab label="Organization Info">
        <Info organizationId={organization.id} />
      </Tab>
    </Tabs>
  );
}
