import { useContext } from "react";
import { UserContext } from "./Context";
import { Tabs, Tab } from "./Tabs";
import { Card } from "react-bootstrap";
import PendingOrganizations from "./PendingOrganizations";
import ClientLogs from "./ClientLogs";

export default function Admin() {
  const { cognitoGroups } = useContext(UserContext)!;

  if (!cognitoGroups.includes("sysadmin")) {
    return <div>You are not authorized to access this page.</div>;
  }
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
        <Card.Header>
          <Card.Title className="mb-0">
            <h4 className="mb-0">Admin</h4>
          </Card.Title>
        </Card.Header>
        <Card.Body>
          <Tabs>
            <Tab label="Pending Organisations">
              <PendingOrganizations />
            </Tab>
            <Tab label="Client Logs">
              <div className="m-2">
                <ClientLogs />
              </div>
            </Tab>
            <Tab label="Statistics">
              <div className="m-2">
                <h5>Statistics</h5>
                <p className="mb-0">
                  This is a placeholder for statistics.
                </p>
              </div>
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>
    </div>
  );
}
