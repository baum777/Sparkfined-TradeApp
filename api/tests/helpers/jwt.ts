import { signJwt } from '../../_lib/auth/jwt';
import { getEnv } from '../../_lib/env';
import jwt from 'jsonwebtoken';

function authEnv() {
  const env = getEnv();
  return {
    secret: env.AUTH_JWT_SECRET,
    issuer: env.AUTH_JWT_ISSUER,
    audience: env.AUTH_JWT_AUDIENCE,
  };
}

export function createValidToken(userId: string = 'test-user') {
  return signJwt({ sub: userId });
}

export function createExpiredToken(userId: string = 'test-user') {
  const env = getEnv();
  return jwt.sign({ sub: userId }, env.AUTH_JWT_SECRET, {
    algorithm: 'HS256',
    issuer: env.AUTH_JWT_ISSUER,
    audience: env.AUTH_JWT_AUDIENCE,
    expiresIn: '-1h',
  });
}

export function createTokenWithWrongIssuer(userId: string = 'test-user') {
  const env = getEnv();
  return jwt.sign({ sub: userId }, env.AUTH_JWT_SECRET, {
    algorithm: 'HS256',
    issuer: 'wrong-issuer',
    audience: env.AUTH_JWT_AUDIENCE,
    expiresIn: '1h',
  });
}

export function createTokenWithWrongAudience(userId: string = 'test-user') {
  const env = getEnv();
  return jwt.sign({ sub: userId }, env.AUTH_JWT_SECRET, {
    algorithm: 'HS256',
    issuer: env.AUTH_JWT_ISSUER,
    audience: 'wrong-audience',
    expiresIn: '1h',
  });
}

export function createTokenWithWrongSecret(userId: string = 'test-user') {
  const env = getEnv();
  return jwt.sign({ sub: userId }, 'wrong-secret-must-be-at-least-32-bytes-long', {
    algorithm: 'HS256',
    issuer: env.AUTH_JWT_ISSUER,
    audience: env.AUTH_JWT_AUDIENCE,
    expiresIn: '1h',
  });
}
