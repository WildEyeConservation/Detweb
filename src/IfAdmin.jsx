/**
 *
 * IfAdmin makes use of the authContext and only allows its child components to render if the currently logged in user
 * is an administrator. This allows for easy customisation of e.g. the Navbar where some items are shown to all users
 * and some items are only shown to administrators.
 *
 * @component
 *
 **/

import React from "react";
const IfAdmin = ({ session, children }) => {
  const groups = session.tokens.accessToken.payload["cognito:groups"];
  if (groups.includes("admin")) {
    return <>{children}</>;
  } else {
    return null;
  }
};

export default IfAdmin;
