// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import React from 'react';

const initializeSession = vi.fn();

vi.mock('@/services/auth', () => ({
  authService: {
    initializeSession,
  },
}));

async function loadBootstrap() {
  vi.resetModules();
  return import('../../src/App');
}

describe('AuthSessionBootstrap', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('does not initialize auth when the auth flag is disabled', async () => {
    vi.stubEnv('VITE_ENABLE_AUTH', 'false');
    const { AuthSessionBootstrap } = await loadBootstrap();

    render(<AuthSessionBootstrap />);

    expect(initializeSession).not.toHaveBeenCalled();
  });

  it('initializes auth when the auth flag is enabled', async () => {
    vi.stubEnv('VITE_ENABLE_AUTH', 'true');
    initializeSession.mockResolvedValueOnce(null);
    const { AuthSessionBootstrap } = await loadBootstrap();

    render(<AuthSessionBootstrap />);

    await waitFor(() => {
      expect(initializeSession).toHaveBeenCalledOnce();
    });
  });
});
