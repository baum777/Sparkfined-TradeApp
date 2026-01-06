import { createHandler } from '../_lib/handler';
import { getPulseHistory } from '../_lib/domain/pulse/repo';
import { logger } from '../_lib/logger';

export default createHandler({
  GET: async ({ req, res }) => {
    const query = req.query.query as string;
    
    if (!query || typeof query !== 'string') {
      res.status(400).json({ status: 'error', error: { code: 'BAD_REQUEST', message: 'Missing query' } });
      return;
    }

    try {
      const history = await getPulseHistory(query);
      res.status(200).json({ status: 'success', data: history });
    } catch (error) {
      logger.error('Pulse History Error', { error: String(error) });
      res.status(500).json({ status: 'error', error: { code: 'INTERNAL', message: 'Failed to fetch history' } });
    }
  }
});

