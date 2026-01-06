import { VercelRequest, VercelResponse } from '@vercel/node';
import https from 'https';
import { IncomingMessage } from 'http';

export function getEnvOrThrow(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return val;
}

export function buildRailwayUrl(path: string, queryParams?: Record<string, string | undefined>): string {
  const baseUrl = getEnvOrThrow('RAILWAY_ALERTS_URL');
  const url = new URL(path.startsWith('/') ? path : `/${path}`, baseUrl);
  
  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, value);
      }
    });
  }
  
  return url.toString();
}

export async function proxyJson(_req: VercelRequest, res: VercelResponse, path: string, method: string = 'GET', body?: any) {
  try {
    const apiKey = getEnvOrThrow('ALERTS_API_KEY');
    const url = buildRailwayUrl(path);

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const upstreamRes = await fetch(url, options);
    const upstreamJson = await upstreamRes.json();

    res.status(upstreamRes.status).json(upstreamJson);
  } catch (error: any) {
    console.error('Proxy error:', error);
    if (error.message.includes('Missing environment variable')) {
      res.status(500).json({ error: 'Configuration error' });
    } else {
      res.status(502).json({ error: 'Upstream error' });
    }
  }
}

export function proxyStream(_req: VercelRequest, res: VercelResponse, path: string, queryParams: Record<string, string | undefined>) {
  try {
    const apiKey = getEnvOrThrow('ALERTS_API_KEY');
    const urlStr = buildRailwayUrl(path, queryParams);

    const options = {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    };

    const request = https.get(urlStr, options, (upstreamRes: IncomingMessage) => {
      // Forward status
      if (upstreamRes.statusCode) {
        res.status(upstreamRes.statusCode);
      }

      // Forward headers relevant for SSE
      const contentType = upstreamRes.headers['content-type'];
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }
      
      if (upstreamRes.headers['cache-control']) {
        res.setHeader('Cache-Control', upstreamRes.headers['cache-control']);
      } else {
        res.setHeader('Cache-Control', 'no-cache, no-transform');
      }
      
      if (upstreamRes.headers['connection']) {
        res.setHeader('Connection', upstreamRes.headers['connection']);
      } else {
        res.setHeader('Connection', 'keep-alive');
      }

      // Pipe data
      upstreamRes.pipe(res);

      upstreamRes.on('error', (err) => {
        console.error('Upstream stream error:', err);
        res.end();
      });
    });

    request.on('error', (err) => {
      console.error('Request error:', err);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Upstream connection failed' });
      }
      res.end();
    });

    // Handle client disconnect
    res.on('close', () => {
      request.destroy();
    });

  } catch (error: any) {
    console.error('Proxy setup error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Configuration error' });
    }
    res.end();
  }
}

