import { signJwt } from '../../_lib/auth/jwt';
import jwt from 'jsonwebtoken';

export const TEST_SECRET = 'test-secret-must-be-at-least-32-bytes-long';
export const TEST_ISSUER = 'test-issuer';
export const TEST_AUDIENCE = 'test-audience';

export function createValidToken(userId: string = 'test-user') {
  return signJwt({ sub: userId });
}

export function createExpiredToken(userId: string = 'test-user') {
  // signJwt default uses real sign, we can override expiresIn but it might not allow negative.
  // We can manually sign here to be sure.
  return jwt.sign({ sub: userId, iss: TEST_ISSUER, aud: TEST_AUDIENCE }, TEST_SECRET, {
    algorithm: 'HS256',
    expiresIn: '-1h',
  });
}

export function createTokenWithWrongIssuer(userId: string = 'test-user') {
  return jwt.sign({ sub: userId, iss: 'wrong-issuer', aud: TEST_AUDIENCE }, TEST_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

export function createTokenWithWrongAudience(userId: string = 'test-user') {
  return jwt.sign({ sub: userId, iss: TEST_ISSUER, aud: 'wrong-audience' }, TEST_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

export function createTokenWithWrongSecret(userId: string = 'test-user') {
  return jwt.sign({ sub: userId, iss: TEST_ISSUER, aud: TEST_AUDIENCE }, 'wrong-secret-must-be-at-least-32-bytes-long', {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

