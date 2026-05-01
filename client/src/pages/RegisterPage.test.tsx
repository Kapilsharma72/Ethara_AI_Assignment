import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import RegisterPage from './RegisterPage';

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

function renderRegisterPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <RegisterPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the registration form with name, email, password fields and submit button', () => {
    renderRegisterPage();

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('shows field-level error for name when API returns errors[{ field: "name" }]', async () => {
    const user = userEvent.setup();
    const apiError = {
      response: {
        status: 422,
        data: {
          message: 'Validation failed',
          errors: [{ field: 'name', message: 'Name is required' }],
        },
      },
    };
    mockedPost.mockRejectedValueOnce(apiError);

    renderRegisterPage();

    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Name is required');
    });
  });

  it('shows field-level error for email when API returns errors[{ field: "email" }]', async () => {
    const user = userEvent.setup();
    const apiError = {
      response: {
        status: 422,
        data: {
          message: 'Validation failed',
          errors: [{ field: 'email', message: 'Invalid email' }],
        },
      },
    };
    mockedPost.mockRejectedValueOnce(apiError);

    renderRegisterPage();

    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email');
    });
  });

  it('shows field-level error for password when API returns errors[{ field: "password" }]', async () => {
    const user = userEvent.setup();
    const apiError = {
      response: {
        status: 422,
        data: {
          message: 'Validation failed',
          errors: [{ field: 'password', message: 'Password too short' }],
        },
      },
    };
    mockedPost.mockRejectedValueOnce(apiError);

    renderRegisterPage();

    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Password too short');
    });
  });

  it('shows general error banner when API returns 409 with { message: "Email already in use", errors: [] }', async () => {
    const user = userEvent.setup();
    const apiError = {
      response: {
        status: 409,
        data: {
          message: 'Email already in use',
          errors: [],
        },
      },
    };
    mockedPost.mockRejectedValueOnce(apiError);

    renderRegisterPage();

    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Email already in use');
    });
  });

  it('calls login() and navigates to /projects on successful registration', async () => {
    const user = userEvent.setup();
    const successPayload = {
      data: {
        token: 'tok',
        user: { id: 1, name: 'Alice', email: 'alice@example.com' },
      },
    };
    mockedPost.mockResolvedValueOnce(successPayload);

    renderRegisterPage();

    await user.type(screen.getByLabelText(/name/i), 'Alice');
    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

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
