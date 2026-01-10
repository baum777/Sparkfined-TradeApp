import { z } from 'zod';
import { invalidQuery, validationError } from '../http/error.js';

/**
 * Validation Helpers
 * Converts Zod errors to AppError with proper details
 */

function zodErrorToDetails(error: z.ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    if (!details[path]) {
      details[path] = [];
    }
    details[path].push(issue.message);
  }
  
  return details;
}

export function validateBody<T>(schema: z.Schema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  
  if (!result.success) {
    // Canonical client-actionable validation error shape/code.
    throw validationError('Validation failed', zodErrorToDetails(result.error));
  }
  
  return result.data;
}

export function validateQuery<T>(
  schema: z.Schema<T>,
  query: Record<string, string | string[] | undefined>
): T {
  // Flatten array values to first element for simple schemas
  const flattened: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(query)) {
    flattened[key] = Array.isArray(value) ? value[0] : value;
  }
  
  const result = schema.safeParse(flattened);
  
  if (!result.success) {
    const details = zodErrorToDetails(result.error);
    const firstError = Object.values(details)[0]?.[0] || 'Invalid query parameters';
    throw invalidQuery(firstError);
  }
  
  return result.data;
}
