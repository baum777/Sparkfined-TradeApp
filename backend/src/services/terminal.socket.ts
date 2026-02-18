/**
 * Terminal Socket.io Integration
 * Handles WebSocket connections for terminal streaming
 */

import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { terminalService } from './terminal.service.js';
import { logger } from '../observability/logger.js';

export function setupTerminalSocket(server: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*', // In production, restrict this to your frontend domain
      methods: ['GET', 'POST'],
    },
    path: '/api/terminal/socket',
  });

  io.on('connection', (socket) => {
    logger.info('Terminal socket: client connected', { socketId: socket.id });

    // Handle process start request
    socket.on('start-process', async (data: { query: string; command?: string }) => {
      try {
        const processId = terminalService.startResearchProcess(data.query, data.command);
        
        // Subscribe to process events
        const stdoutHandler = (pid: string, output: string) => {
          if (pid === processId) {
            socket.emit('terminal-output', { processId: pid, type: 'stdout', data: output });
          }
        };

        const stderrHandler = (pid: string, output: string) => {
          if (pid === processId) {
            socket.emit('terminal-output', { processId: pid, type: 'stderr', data: output });
          }
        };

        const exitHandler = (pid: string, code: number | null, signal: string | null) => {
          if (pid === processId) {
            socket.emit('terminal-exit', { processId: pid, code, signal });
            // Clean up handlers
            terminalService.removeListener('stdout', stdoutHandler);
            terminalService.removeListener('stderr', stderrHandler);
            terminalService.removeListener('exit', exitHandler);
          }
        };

        const errorHandler = (pid: string, error: string) => {
          if (pid === processId) {
            socket.emit('terminal-error', { processId: pid, error });
            // Clean up handlers
            terminalService.removeListener('stdout', stdoutHandler);
            terminalService.removeListener('stderr', stderrHandler);
            terminalService.removeListener('exit', exitHandler);
            terminalService.removeListener('error', errorHandler);
          }
        };

        terminalService.on('stdout', stdoutHandler);
        terminalService.on('stderr', stderrHandler);
        terminalService.on('exit', exitHandler);
        terminalService.on('error', errorHandler);

        socket.emit('process-started', { processId, query: data.query });

        // Clean up on disconnect
        socket.on('disconnect', () => {
          terminalService.removeListener('stdout', stdoutHandler);
          terminalService.removeListener('stderr', stderrHandler);
          terminalService.removeListener('exit', exitHandler);
          terminalService.removeListener('error', errorHandler);
        });
      } catch (error) {
        logger.error('Terminal socket: start process failed', { 
          socketId: socket.id, 
          error: String(error) 
        });
        socket.emit('error', { message: error instanceof Error ? error.message : 'Failed to start process' });
      }
    });

    // Handle kill request
    socket.on('kill-process', (data: { processId: string }) => {
      try {
        const killed = terminalService.killProcess(data.processId);
        socket.emit('process-killed', { processId: data.processId, killed });
      } catch (error) {
        logger.error('Terminal socket: kill process failed', { 
          socketId: socket.id, 
          error: String(error) 
        });
        socket.emit('error', { message: 'Failed to kill process' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info('Terminal socket: client disconnected', { socketId: socket.id });
    });
  });

  return io;
}

