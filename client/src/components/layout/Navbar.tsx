import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../common/Button';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '8px',
    padding: '0 24px',
    height: '56px',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxSizing: 'border-box',
  };

  const logoStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 800,
    color: '#f8fafc',
    textDecoration: 'none',
    letterSpacing: '-0.3px',
    flexShrink: 0,
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const linkStyle = (active: boolean): React.CSSProperties => ({
    color: active ? '#ffffff' : '#94a3b8',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: active ? 600 : 500,
    padding: '6px 12px',
    borderRadius: '6px',
    backgroundColor: active ? '#1e293b' : 'transparent',
    transition: 'all 0.15s',
  });

  const rightStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };

  return (
    <nav aria-label="Main navigation" style={navStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link to={user?.role === 'admin' ? '/overview' : '/my-tasks'} style={logoStyle}>
          Team Task Manager
        </Link>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '16px' }}>
            {user.role === 'admin' ? (
              <>
                <Link to="/overview" style={linkStyle(isActive('/overview'))}>
                  Overview
                </Link>
                <Link to="/projects" style={linkStyle(isActive('/projects'))}>
                  Projects
                </Link>
              </>
            ) : (
              <Link to="/my-tasks" style={linkStyle(isActive('/my-tasks'))}>
                My Tasks
              </Link>
            )}
          </div>
        )}
      </div>

      {user && (
        <div style={rightStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', color: '#cbd5e1' }}>{user.name}</span>
            <span style={{
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: user.role === 'admin' ? '#1d4ed8' : '#059669',
              color: '#ffffff',
            }}>
              {user.role === 'admin' ? 'Admin' : 'Member'}
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleLogout}
            style={{ backgroundColor: 'transparent', color: '#f8fafc', border: '1px solid #334155' }}
          >
            Logout
          </Button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
