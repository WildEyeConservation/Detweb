/**
 *
 * IfAdmin makes use of the authContext and only allows its child components to render if the currently logged in user
 * is an administrator. This allows for easy customisation of e.g. the Navbar where some items are shown to all users
 * and some items are only shown to administrators.
 *
 * @component
 *
 **/

import React, { ReactNode } from "react";

interface Session {
  tokens?: {
    accessToken?: {
      payload?: {
        "cognito:groups"?: string[];
      };
    };
  };
}

interface IfAdminProps {
  session: Session | undefined;
  children: ReactNode;
}

const IfAdmin: React.FC<IfAdminProps> = ({ session, children }) => {
  if (
    session &&
    session.tokens &&
    session.tokens.accessToken &&
    session.tokens.accessToken.payload &&
    session.tokens.accessToken.payload["cognito:groups"]
  ) {
    const groups = session.tokens.accessToken.payload["cognito:groups"];
    if (groups.includes("admin")) {
      return <>{children}</>;
    }
  }
  return null;
};

export default IfAdmin;
