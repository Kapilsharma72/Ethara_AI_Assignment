import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios, { AxiosHeaders } from 'axios';

// Mock window.location since jsdom makes href read-only
Object.defineProperty(window, 'location', {
  value: { href: '' },
  writable: true,
});

// Import the client AFTER setting up window.location
import apiClient from './client';

describe('Axios client interceptors', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.href = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Request interceptor ────────────────────────────────────────────────────

  describe('request interceptor', () => {
    it('attaches Authorization header when token is in localStorage', async () => {
      localStorage.setItem('token', 'my-secret-token');

      // Build a minimal config and run it through the request interceptor
      const config = { headers: new AxiosHeaders() };
      // The request interceptor is the first one registered
      const interceptor = (apiClient.interceptors.request as any).handlers[0];
      const result = interceptor.fulfilled(config);

      expect(result.headers.Authorization).toBe('Bearer my-secret-token');
    });

    it('does NOT attach Authorization header when no token in localStorage', async () => {
      // localStorage is empty (cleared in beforeEach)
      const config = { headers: new AxiosHeaders() };
      const interceptor = (apiClient.interceptors.request as any).handlers[0];
      const result = interceptor.fulfilled(config);

      expect(result.headers.Authorization).toBeUndefined();
    });
  });

  // ─── Response interceptor ───────────────────────────────────────────────────

  describe('response interceptor', () => {
    it('on 401: clears localStorage token and redirects to /login', async () => {
      localStorage.setItem('token', 'existing-token');

      const error = { response: { status: 401 } };
      const interceptor = (apiClient.interceptors.response as any).handlers[0];

      // The rejection handler should reject the promise
      await expect(interceptor.rejected(error)).rejects.toEqual(error);

      expect(localStorage.getItem('token')).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    it('on non-401 errors: does NOT clear token or redirect', async () => {
      localStorage.setItem('token', 'existing-token');

      const error = { response: { status: 500 } };
      const interceptor = (apiClient.interceptors.response as any).handlers[0];

      await expect(interceptor.rejected(error)).rejects.toEqual(error);

      // Token should still be present
      expect(localStorage.getItem('token')).toBe('existing-token');
      // No redirect
      expect(window.location.href).toBe('');
    });

    it('passes through successful responses unchanged', () => {
      const response = { status: 200, data: { ok: true } };
      const interceptor = (apiClient.interceptors.response as any).handlers[0];

      const result = interceptor.fulfilled(response);

      expect(result).toEqual(response);
    });
  });
});
