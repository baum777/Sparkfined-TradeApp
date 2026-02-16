/**
 * JWT Auth Helpers
 * Enforces HS256 signature and strict claims verification
 */

import jwt from 'jsonwebtoken';
import { getEnv } from '../env';
import { unauthorized, ErrorCodes } from '../errors';
import { logger } from '../logger';

export interface JwtPayload {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat?: number;
  [key: string]: unknown;
}

export interface VerifyOptions {
  ignoreExpiration?: boolean;
}

/**
 * Verify JWT from Authorization header
 * Header format: "Bearer <token>"
 */
export function verifyJwtFromAuthHeader(authHeader: string | undefined, options: VerifyOptions = {}): JwtPayload {
  if (!authHeader) {
    throw unauthorized('Missing Authorization header', ErrorCodes.UNAUTHORIZED);
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw unauthorized('Invalid Authorization header format', ErrorCodes.INVALID_AUTH_HEADER);
  }

  const token = authHeader.slice(7);
  if (!token) {
    throw unauthorized('Empty token', ErrorCodes.UNAUTHORIZED);
  }

  return verifyJwt(token, options);
}

/**
 * Verify a raw JWT token string
 * Enforces HS256, Issuer, Audience, Expiry
 */
export function verifyJwt(token: string, options: VerifyOptions = {}): JwtPayload {
  const env = getEnv();
  
  // In dev/test we might want to allow weaker secrets, but structure must match
  const secret = env.AUTH_JWT_SECRET;
  const issuer = env.AUTH_JWT_ISSUER;
  const audience = env.AUTH_JWT_AUDIENCE;

  if (!secret) {
    // Should be caught by env validation in prod, but safe guard here
    logger.error('Missing AUTH_JWT_SECRET in env');
    throw unauthorized('Internal auth configuration error', ErrorCodes.INTERNAL_ERROR);
  }

  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: issuer,
      audience: audience,
      ignoreExpiration: options.ignoreExpiration,
    });

    if (typeof decoded === 'string') {
      throw new Error('Invalid token payload type');
    }

    // Ensure sub exists (userId)
    if (!decoded.sub) {
      throw new Error('Token missing subject (sub)');
    }

    return decoded as JwtPayload;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token verification failed';
    
    if (message.includes('expired')) {
      throw unauthorized('Token expired', ErrorCodes.TOKEN_EXPIRED);
    }
    
    if (message.includes('issuer') || message.includes('audience') || message.includes('jwt audience invalid')) {
      throw unauthorized('Invalid token claims', ErrorCodes.INVALID_TOKEN_CLAIMS);
    }

    // Log the actual verification error for debugging
    logger.debug('JWT verification failed', { error: message });
    
    throw unauthorized('Invalid token', ErrorCodes.INVALID_TOKEN);
  }
}

/**
 * Sign a JWT token (mainly for tests)
 */
export function signJwt(payload: Omit<JwtPayload, 'iss' | 'aud' | 'exp'> & { expiresIn?: string | number }): string {
  const env = getEnv();
  const secret = env.AUTH_JWT_SECRET || 'test-secret';
  const issuer = env.AUTH_JWT_ISSUER || 'tradeapp-api';
  const audience = env.AUTH_JWT_AUDIENCE || 'tradeapp-ui';

  const { expiresIn = '1h', ...rest } = payload;

  return jwt.sign(rest, secret, {
    algorithm: 'HS256',
    issuer,
    audience,
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  });
}
















