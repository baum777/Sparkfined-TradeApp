/**
 * Authentication Service
 * 
 * Verwaltet Authentifizierung und Session-Management
 * (Aktuell als Stub für zukünftige Implementierung)
 */

import { apiClient } from '../api/client';
import { ENABLE_AUTH } from '@/config/features';

export interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  role: 'user' | 'admin';
  preferences: UserPreferences;
  createdAt: string;
  lastLoginAt: string;
}

export interface UserPreferences {
  // Dark-only in v1 UI (no light/system mode exposed).
  theme: 'dark';
  language: 'en' | 'de';
  timezone: string;
  notifications: {
    email: boolean;
    push: boolean;
    alerts: boolean;
  };
  trading: {
    defaultStrategy: string;
    defaultPositionSize: number;
    riskPerTrade: number;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

class AuthService {
  private readonly basePath = '/auth';
  private currentUser: User | null = null;
  private tokenRefreshTimer: NodeJS.Timeout | null = null;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  private assertEnabled(): void {
    if (!ENABLE_AUTH) {
      // Explicitly block all auth-network usage for this milestone.
      // AuthService may remain in the codebase, but must not be required for product flows.
      throw new Error('Auth is disabled (ENABLE_AUTH=false)');
    }
  }

  /**
   * Registriert einen neuen Benutzer
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    this.assertEnabled();
    const authData = await apiClient.post<AuthResponse>(
      `${this.basePath}/register`,
      data
    );

    this.setSession(authData);
    return authData;
  }

  /**
   * Meldet einen Benutzer an
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    this.assertEnabled();
    const authData = await apiClient.post<AuthResponse>(
      `${this.basePath}/login`,
      credentials
    );

    this.setSession(authData);
    return authData;
  }

  /**
   * Meldet den aktuellen Benutzer ab
   */
  async logout(): Promise<void> {
    this.assertEnabled();
    try {
      await apiClient.post(`${this.basePath}/logout`);
    } finally {
      this.clearSession();
    }
  }

  /**
   * Holt die Daten des aktuell angemeldeten Benutzers
   */
  async getCurrentUser(): Promise<User> {
    this.assertEnabled();
    if (this.currentUser) {
      return this.currentUser;
    }

    const user = await apiClient.get<User>(`${this.basePath}/me`);
    
    this.currentUser = user;

    return user;
  }

  /**
   * Aktualisiert das Benutzerprofil
   */
  async updateProfile(data: Partial<User>): Promise<User> {
    this.assertEnabled();
    const user = await apiClient.patch<User>(
      `${this.basePath}/profile`,
      data
    );

    this.currentUser = user;
    return user;
  }

  /**
   * Aktualisiert Benutzer-Präferenzen
   */
  async updatePreferences(
    preferences: Partial<UserPreferences>
  ): Promise<User> {
    this.assertEnabled();
    const user = await apiClient.patch<User>(
      `${this.basePath}/preferences`,
      preferences
    );

    this.currentUser = user;
    return user;
  }

  /**
   * Ändert das Passwort
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    this.assertEnabled();
    await apiClient.post<void>(`${this.basePath}/change-password`, {
      currentPassword,
      newPassword,
    });
  }

  /**
   * Fordert einen Passwort-Reset an
   */
  async requestPasswordReset(email: string): Promise<void> {
    this.assertEnabled();
    await apiClient.post<void>(`${this.basePath}/forgot-password`, { email });
  }

  /**
   * Setzt das Passwort mit einem Reset-Token zurück
   */
  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<void> {
    this.assertEnabled();
    await apiClient.post<void>(`${this.basePath}/reset-password`, {
      token,
      newPassword,
    });
  }

  /**
   * Erneuert den Access Token
   */
  async refreshAccessToken(): Promise<AuthTokens> {
    this.assertEnabled();
    const tokens = await apiClient.post<AuthTokens>(`${this.basePath}/refresh`, {
      refreshToken: this.refreshToken || undefined,
    });

    this.storeTokens(tokens);
    this.scheduleTokenRefresh(tokens.expiresIn);
    return tokens;
  }

  /**
   * Prüft, ob ein Benutzer angemeldet ist
   */
  isAuthenticated(): boolean {
    if (!ENABLE_AUTH) return false;
    if (this.currentUser) return true;
    const token = this.getAccessToken();
    return !!token && !this.isTokenExpired(token);
  }

  /**
   * Holt den Access Token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Holt den Refresh Token
   */
  private getRefreshToken(): string | null {
    return this.refreshToken;
  }

  /**
   * Speichert Tokens
   */
  private storeTokens(tokens: AuthTokens): void {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
  }

  /**
   * Setzt die Session nach erfolgreicher Authentifizierung
   */
  private setSession(authData: AuthResponse): void {
    this.currentUser = authData.user;
    this.storeTokens(authData.tokens);
    this.scheduleTokenRefresh(authData.tokens.expiresIn);
  }

  /**
   * Löscht die Session
   */
  private clearSession(): void {
    this.currentUser = null;
    this.accessToken = null;
    this.refreshToken = null;

    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
  }

  /**
   * Plant automatischen Token-Refresh
   */
  private scheduleTokenRefresh(expiresIn: number): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }

    // Refresh 5 Minuten vor Ablauf
    const refreshTime = (expiresIn - 300) * 1000;

    this.tokenRefreshTimer = setTimeout(async () => {
      try {
        await this.refreshAccessToken();
      } catch (error) {
        console.error('Token refresh failed:', error);
        this.clearSession();
        // Redirect zu Login könnte hier hinzugefügt werden
      }
    }, refreshTime);
  }

  /**
   * Prüft, ob ein Token abgelaufen ist
   */
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000;
      return Date.now() >= exp;
    } catch {
      return true;
    }
  }
}

// Singleton-Instanz
export const authService = new AuthService();
