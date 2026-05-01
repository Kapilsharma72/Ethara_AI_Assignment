import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import LoginPage from './LoginPage';

// Mock apiClient so we control all HTTP calls
vi.mock('../api/client', () => ({
  default: {
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

// Mock useNavigate so we can assert navigation without a real router history
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import apiClient from '../api/client';

const mockedPost = apiClient.post as ReturnType<typeof vi.fn>;

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the login form with email, password fields and submit button', () => {
    renderLoginPage();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows "Invalid email or password" error on 401 response', async () => {
    const user = userEvent.setup();
    const apiError = {
      response: {
        status: 401,
        data: { message: 'Unauthorized', errors: [] },
      },
    };
    mockedPost.mockRejectedValueOnce(apiError);

    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), 'wrong@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password.');
    });
  });

  it('shows generic error on non-401 error (e.g., 500)', async () => {
    const user = userEvent.setup();
    const apiError = {
      response: {
        status: 500,
        data: { message: 'Internal Server Error', errors: [] },
      },
    };
    mockedPost.mockRejectedValueOnce(apiError);

    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'An unexpected error occurred. Please try again.'
      );
    });
  });

  it('calls login() and navigates to /projects on successful login', async () => {
    const user = userEvent.setup();
    const successPayload = {
      data: {
        token: 'tok',
        user: { id: 1, name: 'Alice', email: 'alice@example.com' },
      },
    };
    mockedPost.mockResolvedValueOnce(successPayload);

    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/projects');
    });

    // Verify login() was called by checking localStorage (AuthProvider stores token there)
    expect(localStorage.getItem('token')).toBe('tok');
    expect(JSON.parse(localStorage.getItem('user')!)).toEqual({
      id: 1,
      name: 'Alice',
      email: 'alice@example.com',
    });
  });
});
