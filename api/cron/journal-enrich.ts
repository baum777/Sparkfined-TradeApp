import { createHandler } from '../_lib/handler';
import { sendJson, sendError } from '../_lib/response';
import { getEnv } from '../_lib/env';
import { dequeueEnrichJob, processEnrichJob } from '../_lib/domain/journal/enrich';
import { logger } from '../_lib/logger';

export default createHandler({
  auth: 'none',
  GET: async ({ req, res }) => {
    const env = getEnv();
    const authHeader = req.headers['authorization'];
    
    // Vercel Cron Authentication
    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return sendError(res, 401, 'UNAUTHORIZED', 'Invalid Cron Secret');
    }
    
    let processed = 0;
    const BATCH_LIMIT = 20; // Safe batch size for serverless execution time
    
    // Process queue
    for (let i = 0; i < BATCH_LIMIT; i++) {
      const job = await dequeueEnrichJob();
      
      if (!job) {
        break; // Queue is empty
      }
      
      try {
        await processEnrichJob(job);
        processed++;
      } catch (error) {
        logger.error('Enrich job failed', { 
          jobId: job.entryId, 
          userId: job.userId, 
          error: String(error) 
        });
        // We drop the job on error to prevent poison pill loops.
        // In a robust system, we would re-queue with backoff or use a dead-letter queue.
      }
    }
    
    sendJson(res, { 
      processed, 
      status: processed > 0 ? 'worked' : 'idle',
      timestamp: new Date().toISOString()
    });
  }
});

