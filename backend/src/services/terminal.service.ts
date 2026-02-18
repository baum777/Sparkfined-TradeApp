/**
 * Terminal Service
 * Handles execution of research processes and streams output via WebSocket
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { logger } from '../observability/logger.js';

export interface TerminalProcess {
  id: string;
  process: ChildProcess;
  query: string;
  startTime: number;
}

/**
 * Whitelist of allowed commands for security
 */
const ALLOWED_COMMANDS = [
  'node',
  'npm',
  'npx',
  'python',
  'python3',
  'curl',
  'wget',
  // Add more safe commands as needed
];

/**
 * Allowed command patterns (for commands with arguments)
 */
const ALLOWED_PATTERNS = [
  /^node\s+.*research.*\.js$/i,
  /^python3?\s+.*research.*\.py$/i,
  /^npm\s+run\s+research/i,
  // Add more patterns as needed
];

export class TerminalService extends EventEmitter {
  private processes: Map<string, TerminalProcess> = new Map();
  private processCounter = 0;

  /**
   * Start a research process
   * @param query - Research query string
   * @param command - Optional command to execute (must be whitelisted)
   * @returns Process ID
   */
  startResearchProcess(query: string, command?: string): string {
    const processId = `research-${Date.now()}-${++this.processCounter}`;
    
    // Default command if not provided
    const cmd = command || this.getDefaultCommand(query);
    
    // Validate command
    if (!this.isCommandAllowed(cmd)) {
      const error = `Command not allowed: ${cmd}`;
      logger.warn('Terminal service: command rejected', { cmd, query });
      this.emit('error', processId, error);
      throw new Error(error);
    }

    logger.info('Terminal service: starting research process', { processId, query, cmd });

    // Parse command and arguments
    const parts = cmd.trim().split(/\s+/);
    const executable = parts[0];
    const args = parts.slice(1);

    // Spawn process
    const childProcess = spawn(executable, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        RESEARCH_QUERY: query,
      },
      shell: false, // Security: don't use shell
    });

    const processInfo: TerminalProcess = {
      id: processId,
      process: childProcess,
      query,
      startTime: Date.now(),
    };

    this.processes.set(processId, processInfo);

    // Handle stdout
    childProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      this.emit('stdout', processId, output);
    });

    // Handle stderr
    childProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      this.emit('stderr', processId, output);
    });

    // Handle process exit
    childProcess.on('exit', (code, signal) => {
      logger.info('Terminal service: process exited', { processId, code, signal });
      this.emit('exit', processId, code, signal);
      this.processes.delete(processId);
    });

    // Handle process error
    childProcess.on('error', (error) => {
      logger.error('Terminal service: process error', { processId, error: String(error) });
      this.emit('error', processId, error.message);
      this.processes.delete(processId);
    });

    // Emit start event
    this.emit('start', processId, query);

    return processId;
  }

  /**
   * Kill a running process
   */
  killProcess(processId: string): boolean {
    const processInfo = this.processes.get(processId);
    if (!processInfo) {
      return false;
    }

    logger.info('Terminal service: killing process', { processId });
    processInfo.process.kill('SIGTERM');
    this.processes.delete(processId);
    return true;
  }

  /**
   * Get default command based on query
   */
  private getDefaultCommand(query: string): string {
    // For now, return a simple node command as a demo
    // In production, this would be replaced with actual research scripts
    // Escape quotes in query for safe command execution
    const escapedQuery = query.replace(/"/g, '\\"').replace(/'/g, "\\'");
    const script = `console.log('Researching: ${escapedQuery}'); setTimeout(() => { console.log('Analysis complete'); }, 2000);`;
    return `node -e "${script}"`;
  }

  /**
   * Check if command is allowed
   */
  private isCommandAllowed(cmd: string): boolean {
    const parts = cmd.trim().split(/\s+/);
    const executable = parts[0];

    // Check whitelist
    if (ALLOWED_COMMANDS.includes(executable)) {
      return true;
    }

    // Check patterns
    for (const pattern of ALLOWED_PATTERNS) {
      if (pattern.test(cmd)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all active processes
   */
  getActiveProcesses(): TerminalProcess[] {
    return Array.from(this.processes.values());
  }

  /**
   * Cleanup all processes
   */
  cleanup(): void {
    for (const [id, processInfo] of this.processes.entries()) {
      logger.info('Terminal service: cleaning up process', { processId: id });
      processInfo.process.kill('SIGTERM');
    }
    this.processes.clear();
  }
}

// Singleton instance
export const terminalService = new TerminalService();

