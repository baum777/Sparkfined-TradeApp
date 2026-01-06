import { createHandler } from '../_lib/handler';
import { getPulse, acquireRefreshLock, savePulse } from '../_lib/domain/pulse/repo';
import { generatePulse } from '../_lib/domain/pulse/engine';
import { logger } from '../_lib/logger';

export default createHandler({
  GET: async ({ req, res }) => {
    const query = req.query.query as string;
    
    if (!query || typeof query !== 'string') {
      res.status(400).json({ 
        status: 'error', 
        error: { code: 'BAD_REQUEST', message: 'Missing query param', recoverable: false } 
      });
      return;
    }

    try {
      // 1. Check Cache
      let pulse = await getPulse(query);
      
      if (pulse) {
        pulse.meta.cache = 'hit';
        res.status(200).json({ status: 'success', data: pulse });
        return;
      }

      // 2. Cache Miss: Try to compute inline (if no lock)
      const hasLock = await acquireRefreshLock(query);
      
      if (!hasLock) {
        // Someone else is refreshing, return empty/stale with meta
        // (For now just return null data with pending status if we had a wait pattern, 
        // but here we just return 404 or empty success to indicate "try again")
        res.status(202).json({ 
          status: 'success', 
          data: null, 
          meta: { status: 'refreshing' } 
        });
        return;
      }

      // 3. Generate New
      pulse = await generatePulse(query);
      
      // 4. Save
      await savePulse(pulse);

      res.status(200).json({ status: 'success', data: pulse });

    } catch (error) {
      logger.error('Pulse API error', { error: String(error) });
      res.status(500).json({ 
        status: 'error', 
        error: { code: 'INTERNAL', message: 'Pulse generation failed', recoverable: true } 
      });
    }
  }
});

