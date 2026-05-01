import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/client';
import { Button, Input } from '../components/common';
import type { ApiError } from '../types/api';
import type { AxiosError } from 'axios';

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

function RegisterPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [role, setRole] = useState<'admin' | 'member'>('admin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);
    setIsLoading(true);

    try {
      const response = await apiClient.post<{
        token: string;
        user: { id: number; name: string; email: string; role: 'admin' | 'member' };
      }>('/api/auth/register', { name, email, password, role });

      login(response.data);
      navigate(role === 'member' ? '/my-tasks' : '/projects');
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>;
      const data = axiosError.response?.data;

      if (data) {
        const newFieldErrors: FieldErrors = {};
        let hasFieldError = false;

        if (Array.isArray(data.errors)) {
          for (const detail of data.errors) {
            if (detail.field === 'name') { newFieldErrors.name = detail.message; hasFieldError = true; }
            else if (detail.field === 'email') { newFieldErrors.email = detail.message; hasFieldError = true; }
            else if (detail.field === 'password') { newFieldErrors.password = detail.message; hasFieldError = true; }
          }
        }

        if (Object.keys(newFieldErrors).length > 0) setFieldErrors(newFieldErrors);

        const nonFieldErrors = Array.isArray(data.errors) ? data.errors.filter((d) => !d.field) : [];
        if (nonFieldErrors.length > 0) {
          setGeneralError(nonFieldErrors.map((d) => d.message).join(' '));
        } else if (!hasFieldError && data.message) {
          setGeneralError(data.message);
        }
      } else {
        setGeneralError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Styles ──────────────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    padding: '24px 16px',
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    padding: '40px 36px',
    width: '100%',
    maxWidth: '420px',
    boxSizing: 'border-box',
  };

  const headingStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '8px',
    textAlign: 'center',
  };

  const subheadingStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: '24px',
  };

  const roleLabelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '8px',
  };

  const roleToggleWrapStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginBottom: '20px',
  };

  const roleButtonStyle = (selected: boolean, isAdmin: boolean): React.CSSProperties => ({
    padding: '12px 8px',
    borderRadius: '8px',
    border: selected
      ? `2px solid ${isAdmin ? '#2563eb' : '#059669'}`
      : '2px solid #e5e7eb',
    backgroundColor: selected
      ? isAdmin ? '#eff6ff' : '#ecfdf5'
      : '#ffffff',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.15s',
    outline: 'none',
  });

  const roleIconStyle: React.CSSProperties = {
    fontSize: '24px',
    marginBottom: '4px',
  };

  const roleTitleStyle = (selected: boolean, isAdmin: boolean): React.CSSProperties => ({
    fontSize: '14px',
    fontWeight: 700,
    color: selected ? (isAdmin ? '#1d4ed8' : '#047857') : '#374151',
    marginBottom: '2px',
  });

  const roleDescStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#6b7280',
    lineHeight: 1.4,
  };

  const formStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  const generalErrorStyle: React.CSSProperties = {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '10px 14px',
    fontSize: '14px',
    color: '#dc2626',
  };

  const footerStyle: React.CSSProperties = {
    marginTop: '20px',
    textAlign: 'center',
    fontSize: '14px',
    color: '#6b7280',
  };

  const linkStyle: React.CSSProperties = {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: 500,
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={headingStyle}>Create an account</h1>
        <p style={subheadingStyle}>Join Team Task Manager to collaborate with your team.</p>

        {/* Role selector */}
        <div>
          <span style={roleLabelStyle}>I want to join as</span>
          <div style={roleToggleWrapStyle}>
            <button
              type="button"
              style={roleButtonStyle(role === 'admin', true)}
              onClick={() => setRole('admin')}
              aria-pressed={role === 'admin'}
            >
              <div style={roleIconStyle}>🛠️</div>
              <div style={roleTitleStyle(role === 'admin', true)}>Admin</div>
              <div style={roleDescStyle}>Create &amp; manage projects and tasks</div>
            </button>

            <button
              type="button"
              style={roleButtonStyle(role === 'member', false)}
              onClick={() => setRole('member')}
              aria-pressed={role === 'member'}
            >
              <div style={roleIconStyle}>👤</div>
              <div style={roleTitleStyle(role === 'member', false)}>Member</div>
              <div style={roleDescStyle}>Work on tasks assigned to you</div>
            </button>
          </div>
        </div>

        {generalError && (
          <div role="alert" style={generalErrorStyle}>
            {generalError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate style={formStyle}>
          <Input
            label="Name"
            id="register-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.name}
            required
          />

          <Input
            label="Email"
            id="register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
            required
          />

          <Input
            label="Password"
            id="register-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            style={{ width: '100%', marginTop: '4px' }}
          >
            Create account as {role === 'admin' ? 'Admin' : 'Member'}
          </Button>
        </form>

        <p style={footerStyle}>
          Already have an account?{' '}
          <Link to="/login" style={linkStyle}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
