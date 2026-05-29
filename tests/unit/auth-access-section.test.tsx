// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const login = vi.fn();
const register = vi.fn();
const logout = vi.fn();
const isAuthenticated = vi.fn();

vi.mock('@/services/auth', () => ({
  authService: {
    login,
    register,
    logout,
    isAuthenticated,
  },
}));

async function loadAuthAccessSection() {
  vi.resetModules();
  return import('../../src/components/settings/AuthAccessSection');
}

describe('AuthAccessSection', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('does not render an account entry point when auth is disabled', async () => {
    vi.stubEnv('VITE_ENABLE_AUTH', 'false');
    isAuthenticated.mockReturnValue(false);
    const { AuthAccessSection } = await loadAuthAccessSection();

    render(<AuthAccessSection />);

    expect(screen.queryByTestId('settings-auth-access')).not.toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('renders a minimal login entry point and submits credentials when auth is enabled', async () => {
    vi.stubEnv('VITE_ENABLE_AUTH', 'true');
    isAuthenticated.mockReturnValue(false);
    login.mockResolvedValueOnce({
      user: { email: 'trader@example.com' },
      tokens: { accessToken: 'access', refreshToken: 'refresh', expiresIn: 3600 },
    });
    const { AuthAccessSection } = await loadAuthAccessSection();

    render(<AuthAccessSection />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'trader@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: 'trader@example.com',
        password: 'secret-password',
      });
    });
    expect(screen.getByText('Signed in')).toBeInTheDocument();
  });

  it('submits registration credentials from the auth-enabled entry point', async () => {
    vi.stubEnv('VITE_ENABLE_AUTH', 'true');
    isAuthenticated.mockReturnValue(false);
    register.mockResolvedValueOnce({
      user: { email: 'new@example.com' },
      tokens: { accessToken: 'access', refreshToken: 'refresh', expiresIn: 3600 },
    });
    const { AuthAccessSection } = await loadAuthAccessSection();

    render(<AuthAccessSection />);

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'new-trader' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'long-secret-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith({
        email: 'new@example.com',
        username: 'new-trader',
        password: 'long-secret-password',
      });
    });
    expect(screen.getByText('Signed in')).toBeInTheDocument();
  });
});
