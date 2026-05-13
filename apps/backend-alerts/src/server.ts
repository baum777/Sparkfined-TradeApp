import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health';
import { alertsRouter } from './routes/alerts';
import { eventsRouter } from './routes/events';
import { pushRouter } from './routes/push';
import { streamRouter } from './routes/stream';

export const createServer = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/', (_req, res) => {
    res.json({
      ok: true,
      service: 'backend-alerts',
      health: '/health'
    });
  });

  app.use('/health', healthRouter);
  app.use('/alerts', alertsRouter);
  app.use('/events', eventsRouter);
  app.use('/push', pushRouter);
  app.use('/stream', streamRouter);

  return app;
};
