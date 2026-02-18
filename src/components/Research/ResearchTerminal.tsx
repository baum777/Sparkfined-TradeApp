/**
 * Research Terminal Component
 * Real-time terminal UI for streaming research process logs
 */

import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io, Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Copy, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import '@xterm/xterm/css/xterm.css';

interface ResearchTerminalProps {
  query?: string;
  onProcessStart?: (processId: string) => void;
  onProcessEnd?: (processId: string) => void;
}

export function ResearchTerminal({ query, onProcessStart, onProcessEnd }: ResearchTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const currentProcessIdRef = useRef<string | null>(null);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance
    const terminal = new Terminal({
      theme: {
        background: '#1A1B1E',
        foreground: '#C1C2C5',
        cursor: '#C1C2C5',
        selection: '#3B3D42',
        black: '#1A1B1E',
        red: '#E06C75',
        green: '#98C379',
        yellow: '#E5C07B',
        blue: '#61AFEF',
        magenta: '#C678DD',
        cyan: '#56B6C2',
        white: '#C1C2C5',
        brightBlack: '#5C6370',
        brightRed: '#E06C75',
        brightGreen: '#98C379',
        brightYellow: '#E5C07B',
        brightBlue: '#61AFEF',
        brightMagenta: '#C678DD',
        brightCyan: '#56B6C2',
        brightWhite: '#FFFFFF',
      },
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      cursorBlink: true,
      cursorStyle: 'block',
      allowTransparency: true,
    });

    // Create and attach fit addon
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Open terminal
    terminal.open(terminalRef.current);
    fitAddon.fit();

    terminalInstanceRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    // Connect to Socket.io
    const apiUrl = import.meta.env.VITE_API_URL || '/api';
    const socketUrl = apiUrl.replace(/\/api$/, '') || window.location.origin;
    const socket = io(socketUrl, {
      path: '/api/terminal/socket',
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    // Socket event handlers
    socket.on('connect', () => {
      terminal.writeln('\r\n\x1b[32m✓ Connected to terminal server\x1b[0m\r\n');
    });

    socket.on('disconnect', () => {
      terminal.writeln('\r\n\x1b[31m✗ Disconnected from terminal server\x1b[0m\r\n');
    });

    socket.on('process-started', (data: { processId: string; query: string }) => {
      currentProcessIdRef.current = data.processId;
      terminal.writeln(`\r\n\x1b[36m[Process ${data.processId}]\x1b[0m Starting research: ${data.query}\r\n`);
      onProcessStart?.(data.processId);
    });

    socket.on('terminal-output', (data: { processId: string; type: 'stdout' | 'stderr'; data: string }) => {
      if (data.processId === currentProcessIdRef.current) {
        terminal.write(data.data);
      }
    });

    socket.on('terminal-exit', (data: { processId: string; code: number | null; signal: string | null }) => {
      if (data.processId === currentProcessIdRef.current) {
        const exitCode = data.code !== null ? data.code : '?';
        const signal = data.signal || '';
        terminal.writeln(`\r\n\x1b[33m[Process ${data.processId}] Exited with code ${exitCode}${signal ? ` (signal: ${signal})` : ''}\x1b[0m\r\n`);
        currentProcessIdRef.current = null;
        onProcessEnd?.(data.processId);
      }
    });

    socket.on('terminal-error', (data: { processId: string; error: string }) => {
      if (data.processId === currentProcessIdRef.current) {
        terminal.writeln(`\r\n\x1b[31m[Process ${data.processId}] Error: ${data.error}\x1b[0m\r\n`);
        currentProcessIdRef.current = null;
        onProcessEnd?.(data.processId);
      }
    });

    socket.on('error', (error: { message: string }) => {
      terminal.writeln(`\r\n\x1b[31mSocket error: ${error.message}\x1b[0m\r\n`);
    });

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      socket.disconnect();
      terminal.dispose();
    };
  }, []);

  // Start process when query changes
  useEffect(() => {
    if (query && socketRef.current?.connected && currentProcessIdRef.current === null) {
      socketRef.current.emit('start-process', { query });
    }
  }, [query]);

  const handleClear = () => {
    terminalInstanceRef.current?.clear();
  };

  const handleCopy = async () => {
    const text = terminalInstanceRef.current?.getSelection() || '';
    if (text) {
      try {
        await navigator.clipboard.writeText(text);
        toast({
          title: 'Copied',
          description: 'Terminal output copied to clipboard',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to copy to clipboard',
          variant: 'destructive',
        });
      }
    } else {
      // Copy all terminal content
      const buffer = terminalInstanceRef.current?.buffer.active;
      if (buffer) {
        let allText = '';
        for (let i = 0; i < buffer.length; i++) {
          const line = buffer.getLine(i);
          if (line) {
            allText += line.translateToString(true) + '\n';
          }
        }
        try {
          await navigator.clipboard.writeText(allText);
          toast({
            title: 'Copied',
            description: 'All terminal logs copied to clipboard',
          });
        } catch (error) {
          toast({
            title: 'Error',
            description: 'Failed to copy to clipboard',
            variant: 'destructive',
          });
        }
      }
    }
  };

  const handleKill = () => {
    if (currentProcessIdRef.current && socketRef.current?.connected) {
      socketRef.current.emit('kill-process', { processId: currentProcessIdRef.current });
      currentProcessIdRef.current = null;
    }
  };

  return (
    <div className="flex flex-col border rounded-lg bg-[#1A1B1E] overflow-hidden">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#25262B] border-b border-[#373A40]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#C1C2C5]">Terminal</span>
          {currentProcessIdRef.current && (
            <span className="text-xs text-[#5C6370]">Process: {currentProcessIdRef.current.slice(0, 8)}...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2 text-[#C1C2C5] hover:text-[#FFFFFF] hover:bg-[#373A40]"
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </Button>
          {currentProcessIdRef.current && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleKill}
              className="h-7 px-2 text-[#E06C75] hover:text-[#FFFFFF] hover:bg-[#373A40]"
            >
              Kill
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-7 px-2 text-[#C1C2C5] hover:text-[#FFFFFF] hover:bg-[#373A40]"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      </div>

      {/* Terminal Container */}
      <div
        ref={terminalRef}
        className="terminal-container"
        style={{
          height: '300px',
          width: '100%',
          padding: '8px',
          overflow: 'hidden',
        }}
      />
    </div>
  );
}

