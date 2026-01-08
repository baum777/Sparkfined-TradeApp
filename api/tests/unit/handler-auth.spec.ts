import { describe, it, expect, vi } from 'vitest';
import { createHandler } from '../../_lib/handler';
import { createMockRequest, createMockResponse } from '../helpers/vercelMock';
import { createValidToken } from '../helpers/jwt';
import { ErrorCodes } from '../../_lib/errors';

describe('Handler Auth Integration', () => {
  it('allows access with valid token (auth required)', async () => {
    const handlerSpy = vi.fn().mockResolvedValue(undefined);
    const handler = createHandler({
      auth: 'required',
      GET: handlerSpy,
    });

    const token = createValidToken('user-123');
    const req = createMockRequest({
      headers: { authorization: `Bearer ${token}` }
    });
    const res = createMockResponse();

    await handler(req, res);

    // Should call handler
    expect(handlerSpy).toHaveBeenCalled();
    
    // Should pass userId in context
    const ctx = handlerSpy.mock.calls[0][0];
    expect(ctx.userId).toBe('user-123');
    
    // Should not send error
    expect(res.status).not.toHaveBeenCalledWith(401);
  });

  it('denies access without token (auth required default)', async () => {
    const handlerSpy = vi.fn();
    const handler = createHandler({
      // auth: 'required' is default
      GET: handlerSpy,
    });

    const req = createMockRequest(); // no auth header
    const res = createMockResponse();

    await handler(req, res);

    expect(handlerSpy).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    
    // Check error code in JSON response
    const jsonCall = (res.json as any).mock.calls[0][0];
    expect(jsonCall.error.code).toBe(ErrorCodes.UNAUTHORIZED);
  });

  it('allows public access (auth none)', async () => {
    const handlerSpy = vi.fn().mockResolvedValue(undefined);
    const handler = createHandler({
      auth: 'none',
      GET: handlerSpy,
    });

    const req = createMockRequest();
    const res = createMockResponse();

    await handler(req, res);

    expect(handlerSpy).toHaveBeenCalled();
    const ctx = handlerSpy.mock.calls[0][0];
    expect(ctx.userId).toBe('anon');
  });

  it('isolates users correctly', async () => {
    const handlerSpy = vi.fn().mockResolvedValue(undefined);
    const handler = createHandler({ GET: handlerSpy });
    const res = createMockResponse();

    // Request 1: User A
    const tokenA = createValidToken('user-A');
    await handler(createMockRequest({ headers: { authorization: `Bearer ${tokenA}` } }), res);
    expect(handlerSpy.mock.calls[0][0].userId).toBe('user-A');

    // Request 2: User B
    const tokenB = createValidToken('user-B');
    await handler(createMockRequest({ headers: { authorization: `Bearer ${tokenB}` } }), res);
    expect(handlerSpy.mock.calls[1][0].userId).toBe('user-B');
  });
});

