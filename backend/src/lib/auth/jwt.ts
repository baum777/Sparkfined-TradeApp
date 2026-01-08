import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { getEnv } from '../../config/env.js';

export interface AuthUser {
  userId: string;
  tier?: 'free' | 'pro' | 'vip';
  // Add other claims as needed
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const env = getEnv();
    const secret: Secret = env.JWT_SECRET;
    
    const decoded = jwt.verify(token, secret);
    
    if (typeof decoded === 'object' && decoded !== null && 'sub' in decoded) {
      const payload = decoded as { sub: string; tier?: string };
      return {
        userId: payload.sub,
        tier: (payload.tier as 'free' | 'pro' | 'vip') || 'free'
      };
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

export function signToken(payload: { userId: string; tier?: string }, expiresIn = '7d'): string {
  const env = getEnv();
  const secret: Secret = env.JWT_SECRET;
  const options: SignOptions = { expiresIn: expiresIn as SignOptions['expiresIn'] };
  return jwt.sign(
    { sub: payload.userId, tier: payload.tier },
    secret,
    options
  );
}
