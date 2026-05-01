import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Routes only admins can access
const ADMIN_ONLY_PATHS = ['/overview', '/projects'];
// Routes only members can access
const MEMBER_ONLY_PATHS = ['/my-tasks'];

function PrivateRoute(): React.JSX.Element {
  const { token, user } = useAuth();
  const location = useLocation();

  // Not logged in → go to login
  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const path = location.pathname;

  // Member trying to access admin-only pages → redirect to my-tasks
  if (user.role === 'member') {
    const isAdminPath = ADMIN_ONLY_PATHS.some((p) => path === p || path.startsWith(p + '/'));
    if (isAdminPath) {
      return <Navigate to="/my-tasks" replace />;
    }
  }

  // Admin trying to access member-only pages → redirect to overview
  if (user.role === 'admin') {
    const isMemberPath = MEMBER_ONLY_PATHS.some((p) => path === p || path.startsWith(p + '/'));
    if (isMemberPath) {
      return <Navigate to="/overview" replace />;
    }
  }

  return <Outlet />;
}

export default PrivateRoute;
