import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AuthProvider, useAuth, User } from './AuthContext';

// Helper component that exposes auth state and actions via the DOM
function TestConsumer(): React.JSX.Element {
  const { user, token, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="token">{token ?? 'null'}</span>
      <span data-testid="user">{user ? JSON.stringify(user) : 'null'}</span>
      <button
        onClick={() =>
          login({
            token: 'test-token',
            user: { id: 1, name: 'Alice', email: 'alice@example.com' },
          })
        }
      >
        login
      </button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

function renderWithProvider(): void {
  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('starts with null user and token when localStorage is empty', () => {
    renderWithProvider();
    expect(screen.getByTestId('token').textContent).toBe('null');
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('hydrates state from localStorage on initial load', () => {
    const user: User = { id: 2, name: 'Bob', email: 'bob@example.com' };
    localStorage.setItem('token', 'stored-token');
    localStorage.setItem('user', JSON.stringify(user));

    renderWithProvider();

    expect(screen.getByTestId('token').textContent).toBe('stored-token');
    expect(screen.getByTestId('user').textContent).toBe(JSON.stringify(user));
  });

  it('login stores token and user in state and localStorage', async () => {
    renderWithProvider();

    await userEvent.click(screen.getByRole('button', { name: 'login' }));

    expect(screen.getByTestId('token').textContent).toBe('test-token');
    expect(JSON.parse(screen.getByTestId('user').textContent!)).toEqual({
      id: 1,
      name: 'Alice',
      email: 'alice@example.com',
    });
    expect(localStorage.getItem('token')).toBe('test-token');
    expect(JSON.parse(localStorage.getItem('user')!)).toEqual({
      id: 1,
      name: 'Alice',
      email: 'alice@example.com',
    });
  });

  it('logout clears state and localStorage', async () => {
    localStorage.setItem('token', 'existing-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, name: 'Alice', email: 'alice@example.com' }));

    renderWithProvider();

    await userEvent.click(screen.getByRole('button', { name: 'logout' }));

    expect(screen.getByTestId('token').textContent).toBe('null');
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('recovers gracefully from corrupted localStorage user JSON', () => {
    localStorage.setItem('token', 'some-token');
    localStorage.setItem('user', 'not-valid-json{{{');

    renderWithProvider();

    // Should fall back to unauthenticated state
    expect(screen.getByTestId('token').textContent).toBe('null');
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('useAuth throws when used outside AuthProvider', () => {
    // Suppress React's error boundary console output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function Bare(): React.JSX.Element {
      useAuth();
      return <div />;
    }

    expect(() => render(<Bare />)).toThrow('useAuth must be used within an AuthProvider');
    consoleSpy.mockRestore();
  });
});
