/**
 *
 * IfAdmin makes use of the authContext and only allows its child components to render if the currently logged in user
 * is an administrator. This allows for easy customisation of e.g. the Navbar where some items are shown to all users
 * and some items are only shown to administrators.
 *
 * @component
 *
 **/

import React, { ReactNode, useContext } from "react";
import { UserContext, UserContextType } from "./Context";



interface IfAdminProps {
  children: ReactNode;
}

const IfProjectAdmin: React.FC<IfAdminProps> = ({ children }) => {
  const { currentPM } = useContext(UserContext) as UserContextType;
  if (
    currentPM?.isAdmin
  ) {
      return <>{children}</>;
    }
  else return null;
};

export default IfProjectAdmin;
