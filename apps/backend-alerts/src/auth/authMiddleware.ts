import { Request, Response, NextFunction } from 'express';
import { env } from '../env';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (env.API_KEY.trim().length === 0) {
    return res.status(503).json({ error: 'Service misconfigured' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    // Check if it's just a health check? No, health is public usually. 
    // This middleware is applied to protected routes.
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  if (token !== env.API_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
};
