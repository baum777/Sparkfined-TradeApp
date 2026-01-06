import { createHandler } from '../../_lib/handler';
import { sendJson, sendError } from '../../_lib/response';
import { getEnv } from '../../_lib/env';
import { ErrorCodes } from '../../_lib/errors';
import { validateBody } from '../../_lib/validation';
import { heliusWebhookPayloadSchema } from '../../_lib/domain/walletIngest/helius';
import { ingestHeliusWebhook } from '../../_lib/domain/walletIngest/ingest';

export default createHandler({
  auth: 'none',
  
  POST: async ({ req, res }) => {
    const env = getEnv();
    
    // 1. Feature Flag Check
    if (!env.AUTO_CAPTURE_ENABLED) {
      return sendJson(res, { message: 'Auto capture disabled' });
    }
    
    // 2. Secret Validation
    const secret = req.headers['x-webhook-secret'];
    if (secret !== env.HELIUS_WEBHOOK_SECRET) {
      // Return 401 but ensure Helius sees failure? 
      // Helius expects 200 OK to stop retrying. If we return 401, they retry.
      // This is correct behavior for invalid secret (auth failure).
      return sendError(res, 401, ErrorCodes.WEBHOOK_UNAUTHORIZED, 'Invalid webhook secret');
    }
    
    // 3. Parse Body
    // Vercel/Express might parse JSON automatically? `req.body`
    const payload = validateBody(heliusWebhookPayloadSchema, req.body);
    
    // 4. Ingest
    const result = await ingestHeliusWebhook(payload);
    
    sendJson(res, { ok: true, ...result });
  }
});

