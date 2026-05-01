import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/client';
import { Button, Input } from '../components/common';
import type { ApiError } from '../types/api';
import type { AxiosError } from 'axios';

function LoginPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiClient.post<{
        token: string;
        user: { id: number; name: string; email: string; role: 'admin' | 'member' };
      }>('/api/auth/login', { email, password });

      login(response.data);
      // Redirect based on role: members go to My Tasks, admins go to Projects
      navigate(response.data.user.role === 'member' ? '/my-tasks' : '/projects');
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>;
      const status = axiosError.response?.status;
      if (status === 401) {
        setError('Invalid email or password.');
      } else {
        setError('An unexpected error occurred. Please try again.');
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
    marginBottom: '28px',
  };

  const formStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  const errorStyle: React.CSSProperties = {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    padding: '10px 14px',
    fontSize: '14px',
    color: '#dc2626',
    marginBottom: '4px',
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
        <h1 style={headingStyle}>Sign in</h1>
        <p style={subheadingStyle}>Welcome back to Team Task Manager.</p>

        {error && (
          <div role="alert" style={errorStyle}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate style={formStyle}>
          <Input
            label="Email"
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Password"
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            style={{ width: '100%', marginTop: '4px' }}
          >
            Sign in
          </Button>
        </form>

        <p style={footerStyle}>
          Don't have an account?{' '}
          <Link to="/register" style={linkStyle}>
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
