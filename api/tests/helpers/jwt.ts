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
  // signJwt default uses real sign, we can override expiresIn but it might not allow negative.
  // We can manually sign here to be sure.
  const env = authEnv();
  return jwt.sign({ sub: userId, iss: env.issuer, aud: env.audience }, env.secret, {
    algorithm: 'HS256',
    expiresIn: '-1h',
  });
}

export function createTokenWithWrongIssuer(userId: string = 'test-user') {
  const env = authEnv();
  return jwt.sign({ sub: userId, iss: 'wrong-issuer', aud: env.audience }, env.secret, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

export function createTokenWithWrongAudience(userId: string = 'test-user') {
  const env = authEnv();
  return jwt.sign({ sub: userId, iss: env.issuer, aud: 'wrong-audience' }, env.secret, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

export function createTokenWithWrongSecret(userId: string = 'test-user') {
  const env = authEnv();
  return jwt.sign({ sub: userId, iss: env.issuer, aud: env.audience }, 'wrong-secret-must-be-at-least-32-bytes-long', {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}
