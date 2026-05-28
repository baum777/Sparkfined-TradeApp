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

function makeRefreshResponse() {
  return {
    tokens: {
      accessToken: 'refreshed-access-token',
      refreshToken: 'refreshed-refresh-token',
      expiresIn: 3600,
    },
  };
}

describe('AuthService auth-enabled token wiring', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_ENABLE_AUTH', 'true');
    vi.resetModules();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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

  it('notifies the service worker with the access token after login', async () => {
    const postMessage = vi.fn();
    vi.stubGlobal('navigator', {
      serviceWorker: {
        controller: { postMessage },
      },
    });
    apiClientMock.post.mockResolvedValueOnce(makeAuthResponse());
    const { authService } = await import('../../src/services/auth/auth.service');

    await authService.login({ email: 'trader@example.com', password: 'secret' });

    expect(postMessage).toHaveBeenCalledWith({
      type: 'SW_AUTH_UPDATE',
      accessToken: 'access-token',
    });
  });

  it('reattaches the refreshed access token to the API client', async () => {
    apiClientMock.post
      .mockResolvedValueOnce(makeAuthResponse())
      .mockResolvedValueOnce(makeRefreshResponse());
    const { authService } = await import('../../src/services/auth/auth.service');

    await authService.login({ email: 'trader@example.com', password: 'secret' });
    vi.clearAllMocks();
    await authService.refreshAccessToken();

    expect(apiClientMock.post).toHaveBeenCalledWith('/auth/refresh', {
      refreshToken: 'refresh-token',
    });
    expect(apiClientMock.setAuthToken).toHaveBeenCalledWith('refreshed-access-token');
  });

  it('sends the csrf token header when refreshing with a csrf cookie', async () => {
    vi.stubGlobal('document', {
      cookie: 'theme=dark; csrf_token=csrf-refresh-token',
    });
    apiClientMock.post
      .mockResolvedValueOnce(makeAuthResponse())
      .mockResolvedValueOnce(makeRefreshResponse());
    const { authService } = await import('../../src/services/auth/auth.service');

    await authService.login({ email: 'trader@example.com', password: 'secret' });
    vi.clearAllMocks();
    await authService.refreshAccessToken();

    expect(apiClientMock.post).toHaveBeenCalledWith(
      '/auth/refresh',
      { refreshToken: 'refresh-token' },
      { headers: { 'x-csrf-token': 'csrf-refresh-token' } }
    );
  });

  it('initializes a session from refresh cookies and loads the current user', async () => {
    vi.stubGlobal('document', {
      cookie: 'csrf_token=csrf-init-token',
    });
    apiClientMock.post.mockResolvedValueOnce(makeRefreshResponse());
    apiClientMock.get.mockResolvedValueOnce(makeAuthResponse().user);
    const { authService } = await import('../../src/services/auth/auth.service');

    const user = await authService.initializeSession();

    expect(apiClientMock.post).toHaveBeenCalledWith(
      '/auth/refresh',
      { refreshToken: undefined },
      { headers: { 'x-csrf-token': 'csrf-init-token' } }
    );
    expect(apiClientMock.setAuthToken).toHaveBeenCalledWith('refreshed-access-token');
    expect(apiClientMock.get).toHaveBeenCalledWith('/auth/me');
    expect(user).toMatchObject({ id: 'user-1', email: 'trader@example.com' });
    expect(authService.isAuthenticated()).toBe(true);
  });

  it('returns null and clears auth state when session initialization fails', async () => {
    apiClientMock.post
      .mockResolvedValueOnce(makeAuthResponse())
      .mockRejectedValueOnce(new Error('refresh failed'));
    const { authService } = await import('../../src/services/auth/auth.service');

    await authService.login({ email: 'trader@example.com', password: 'secret' });
    vi.clearAllMocks();

    const user = await authService.initializeSession();

    expect(user).toBeNull();
    expect(apiClientMock.removeAuthToken).toHaveBeenCalledOnce();
    expect(authService.isAuthenticated()).toBe(false);
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

  it('sends the csrf token header when logging out with a csrf cookie', async () => {
    vi.stubGlobal('document', {
      cookie: 'csrf_token=csrf-logout-token',
    });
    apiClientMock.post
      .mockResolvedValueOnce(makeAuthResponse())
      .mockResolvedValueOnce({ ok: true });
    const { authService } = await import('../../src/services/auth/auth.service');

    await authService.login({ email: 'trader@example.com', password: 'secret' });
    vi.clearAllMocks();
    await authService.logout();

    expect(apiClientMock.post).toHaveBeenCalledWith(
      '/auth/logout',
      undefined,
      { headers: { 'x-csrf-token': 'csrf-logout-token' } }
    );
  });

  it('clears the service worker auth token when logout fails', async () => {
    const postMessage = vi.fn();
    vi.stubGlobal('navigator', {
      serviceWorker: {
        controller: { postMessage },
      },
    });
    apiClientMock.post
      .mockResolvedValueOnce(makeAuthResponse())
      .mockRejectedValueOnce(new Error('network down'));
    const { authService } = await import('../../src/services/auth/auth.service');

    await authService.login({ email: 'trader@example.com', password: 'secret' });
    postMessage.mockClear();

    await expect(authService.logout()).rejects.toThrow('network down');
    expect(postMessage).toHaveBeenCalledWith({
      type: 'SW_AUTH_UPDATE',
      accessToken: null,
    });
  });
});
