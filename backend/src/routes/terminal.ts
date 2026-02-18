/**
 * Terminal Routes
 * WebSocket endpoint for terminal streaming
 */

import type { ParsedRequest, ServerResponse } from '../http/router.js';
import { terminalService } from '../services/terminal.service.js';
import { logger } from '../observability/logger.js';
import { handleError, badRequest, notFound } from '../http/error.js';
import { sendJson } from '../http/response.js';

/**
 * Start a research process
 * POST /api/terminal/start
 */
export async function handleTerminalStart(
  req: ParsedRequest,
  res: ServerResponse
): Promise<void> {
  try {
    const body = req.body as { query: string; command?: string };
    
    if (!body || typeof body.query !== 'string') {
      throw badRequest('Missing or invalid query parameter');
    }

    const processId = terminalService.startResearchProcess(body.query, body.command);

    sendJson(res, {
      processId,
      query: body.query,
    });
  } catch (error) {
    logger.error('Terminal start failed', { error: String(error) });
    handleError(res, error as Error);
  }
}

/**
 * Kill a research process
 * POST /api/terminal/kill/:processId
 */
export async function handleTerminalKill(
  req: ParsedRequest,
  res: ServerResponse
): Promise<void> {
  try {
    const { processId } = req.params;
    
    if (!processId) {
      throw badRequest('Missing processId parameter');
    }

    const killed = terminalService.killProcess(processId);

    if (!killed) {
      throw notFound('Process not found');
    }

    sendJson(res, {
      processId,
      killed: true,
    });
  } catch (error) {
    logger.error('Terminal kill failed', { error: String(error) });
    handleError(res, error as Error);
  }
}

/**
 * Get active processes
 * GET /api/terminal/processes
 */
export async function handleTerminalProcesses(
  req: ParsedRequest,
  res: ServerResponse
): Promise<void> {
  try {
    const processes = terminalService.getActiveProcesses().map((p) => ({
      id: p.id,
      query: p.query,
      startTime: p.startTime,
    }));

    sendJson(res, {
      processes,
    });
  } catch (error) {
    logger.error('Terminal processes list failed', { error: String(error) });
    handleError(res, error as Error);
  }
}

