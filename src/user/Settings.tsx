import { SettingsIcon } from "lucide-react";
import { useContext, useMemo, useEffect, useState } from "react";
import { GlobalContext, UserContext } from "../Context";
import { useOptimisticUpdates } from "../useOptimisticUpdates";
import { Schema } from "../../amplify/data/resource";
import Button from "react-bootstrap/Button";
import { useUsers } from "../apiInterface";
import { fetchAllPaginatedResults } from "../utils";
import { Bell, Check, X } from "lucide-react";
import { Card } from "react-bootstrap";

/* 
  For now, this is a popup that displays the user's account information
  untill we have a settings page.
*/

export default function Settings() {
  const [show, setShow] = useState(false);
  const { user } = useContext(UserContext)!;
  const { users } = useUsers();

  const username = users?.find((u) => u.id === user.username)?.name;
  const email = users?.find((u) => u.id === user.username)?.email;

  return (
    <div>
      <button
        className="text-muted px-2"
        style={{
          position: "relative",
          backgroundColor: "transparent",
          border: "none",
          cursor: "pointer",
        }}
        onClick={() => setShow(!show)}
      >
        <SettingsIcon />
      </button>
      {show && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 1,
          }}
          onClick={() => setShow(false)}
        />
      )}
      {username && (
        <Card
          style={{
            position: "absolute",
            top: 56,
            right: 24,
            width: "400px",
            opacity: show ? 1 : 0,
            pointerEvents: show ? "auto" : "none",
            transition: "opacity 0.15s ease-in-out",
            overflow: "auto",
            zIndex: 2,
          }}
        >
          <Card.Body>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <Card.Title className="mb-0">Settings</Card.Title>
              <X onClick={() => setShow(false)} style={{ cursor: "pointer" }} />
            </div>
            <div className="d-flex flex-column gap-2">
              <p className="mb-0">{username}</p>
              <p className="mb-0">{email}</p>
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}
