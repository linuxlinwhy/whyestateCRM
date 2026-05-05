import { Navigate } from 'react-router-dom';
import { isAuthed, getCurrentUser } from '@/lib/auth';
import { getUserRole, type Role } from '@/lib/permissions';
import { ROUTE_PATHS } from '@/lib/index';

const MASTER_ADMIN_EMAIL = 'linux@whyestate.com';

function isMaster(email: string | undefined): boolean {
  return (email ?? '').toLowerCase() === MASTER_ADMIN_EMAIL;
}

export default function RequireAuth({
  children,
  masterOnly = false,
  requireRoles,
}: {
  children: React.ReactNode;
  masterOnly?: boolean;
  requireRoles?: Role[];
}) {
  if (!isAuthed()) return <Navigate to="/" replace />;
  const me = getCurrentUser();
  if (masterOnly) {
    if (!isMaster(me?.email)) return <Navigate to={ROUTE_PATHS.LEADS} replace />;
  }
  if (requireRoles && requireRoles.length > 0) {
    const role: Role = isMaster(me?.email)
      ? 'master_admin'
      : me?.email
        ? getUserRole(me.email)
        : 'viewer';
    if (!requireRoles.includes(role)) {
      return <Navigate to={ROUTE_PATHS.LEADS} replace />;
    }
  }
  return <>{children}</>;
}
