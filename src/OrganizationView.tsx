import { Outlet } from 'react-router-dom';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useContext } from 'react';
import { UserContext } from './Context.tsx';

export default function OrganizationView() {
  const { organizationId } = useParams();
  const { isOrganizationAdmin } = useContext(UserContext)!;
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (
      organizationId &&
      (location.pathname === `/manage-organization/${organizationId}/` ||
        location.pathname === `/manage-organization/${organizationId}`)
    ) {
      navigate(`/manage-organization/${organizationId}/users`);
    }
  }, [location.pathname, organizationId]);

  return isOrganizationAdmin && organizationId ? <Outlet /> : null;
}
