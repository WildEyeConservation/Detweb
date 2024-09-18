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
import { Schema } from "../amplify/data/resource";




interface IfAdminProps {
  currentPM?: Schema['UserProjectMembership']['type'];
  children: ReactNode;
}

const IfProjectAdmin: React.FC<IfAdminProps> = ({ currentPM, children }) => {
  if (
    currentPM?.isAdmin
  ) {
      return <>{children}</>;
    }
  else return null;
};

export default IfProjectAdmin;
