import type { ParsedRequest } from './router.js';
import { AppError, ErrorCodes } from './error.js';

/**
 * Canonical auth gate for protected endpoints.
 * - If no valid JWT is present, router sets `userId = "anon"`.
 * - Protected endpoints must fail with 401 and ErrorCodes.UNAUTHENTICATED.
 */
export function requireAuth(req: ParsedRequest): void {
  if (req.userId === 'anon') {
    throw new AppError('Unauthenticated', 401, ErrorCodes.UNAUTHENTICATED);
  }
}

