import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiClientMock = {
  post: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  setAuthToken: vi.fn(),
  removeAuthToken: vi.fn(),
};

vi.mock('../../src/services/api/client', () => ({
  apiClient: apiClientMock,
}));

function makeAuthResponse() {
  return {
    user: {
      id: 'user-1',
      email: 'trader@example.com',
      username: 'trader',
      role: 'user',
      preferences: {
        theme: 'dark',
        language: 'en',
        timezone: 'UTC',
        notifications: { email: false, push: true, alerts: true },
        trading: { defaultStrategy: 'swing', defaultPositionSize: 100, riskPerTrade: 1 },
      },
      createdAt: '2026-05-28T00:00:00.000Z',
      lastLoginAt: '2026-05-28T00:00:00.000Z',
    },
    tokens: {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
    },
  };
}

describe('AuthService auth-enabled token wiring', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_ENABLE_AUTH', 'true');
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('attaches the access token to the API client after login', async () => {
    apiClientMock.post.mockResolvedValueOnce(makeAuthResponse());
    const { authService } = await import('../../src/services/auth/auth.service');

    await authService.login({ email: 'trader@example.com', password: 'secret' });

    expect(apiClientMock.post).toHaveBeenCalledWith('/auth/login', {
      email: 'trader@example.com',
      password: 'secret',
    });
    expect(apiClientMock.setAuthToken).toHaveBeenCalledWith('access-token');
  });

  it('reattaches the refreshed access token to the API client', async () => {
    apiClientMock.post
      .mockResolvedValueOnce(makeAuthResponse())
      .mockResolvedValueOnce({
        accessToken: 'refreshed-access-token',
        refreshToken: 'refreshed-refresh-token',
        expiresIn: 3600,
      });
    const { authService } = await import('../../src/services/auth/auth.service');

    await authService.login({ email: 'trader@example.com', password: 'secret' });
    vi.clearAllMocks();
    await authService.refreshAccessToken();

    expect(apiClientMock.post).toHaveBeenCalledWith('/auth/refresh', {
      refreshToken: 'refresh-token',
    });
    expect(apiClientMock.setAuthToken).toHaveBeenCalledWith('refreshed-access-token');
  });

  it('removes the API client auth token when logout fails', async () => {
    apiClientMock.post
      .mockResolvedValueOnce(makeAuthResponse())
      .mockRejectedValueOnce(new Error('network down'));
    const { authService } = await import('../../src/services/auth/auth.service');

    await authService.login({ email: 'trader@example.com', password: 'secret' });
    vi.clearAllMocks();

    await expect(authService.logout()).rejects.toThrow('network down');
    expect(apiClientMock.removeAuthToken).toHaveBeenCalledOnce();
  });
});
