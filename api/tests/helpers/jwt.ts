import { signJwt } from '../../_lib/auth/jwt';
import jwt from 'jsonwebtoken';

export const TEST_SECRET = process.env.AUTH_JWT_SECRET || 'test-secret-must-be-at-least-32-bytes-long';
export const TEST_ISSUER = process.env.AUTH_JWT_ISSUER || 'test-issuer';
export const TEST_AUDIENCE = process.env.AUTH_JWT_AUDIENCE || 'test-audience';

export function createValidToken(userId: string = 'test-user') {
  return signJwt({ sub: userId });
}

export function createExpiredToken(userId: string = 'test-user') {
  return jwt.sign({ sub: userId }, TEST_SECRET, {
    algorithm: 'HS256',
    issuer: TEST_ISSUER,
    audience: TEST_AUDIENCE,
    expiresIn: '-1h',
  });
}

export function createTokenWithWrongIssuer(userId: string = 'test-user') {
  return jwt.sign({ sub: userId }, TEST_SECRET, {
    algorithm: 'HS256',
    issuer: 'wrong-issuer',
    audience: TEST_AUDIENCE,
    expiresIn: '1h',
  });
}

export function createTokenWithWrongAudience(userId: string = 'test-user') {
  return jwt.sign({ sub: userId }, TEST_SECRET, {
    algorithm: 'HS256',
    issuer: TEST_ISSUER,
    audience: 'wrong-audience',
    expiresIn: '1h',
  });
}

export function createTokenWithWrongSecret(userId: string = 'test-user') {
  return jwt.sign({ sub: userId }, 'wrong-secret-must-be-at-least-32-bytes-long', {
    algorithm: 'HS256',
    issuer: TEST_ISSUER,
    audience: TEST_AUDIENCE,
    expiresIn: '1h',
  });
}

