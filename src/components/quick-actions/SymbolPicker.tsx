/**
 * Symbol Picker Component (v1)
 * Shared component for selecting symbols with quick actions
 * Per Global UI Infrastructure spec - TASK C
 * 
 * Features:
 * - Recents (localStorage, cap 12, dedupe)
 * - Watchlist (existing local source)
 * - Symbol heuristic (len >= 32 + no spaces = Contract)
 * - Keyboard navigation (↑↓ Enter Esc)
 * - One-tap actions per symbol
 */

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LineChart, 
  Play, 
  Bell, 
  BookOpen, 
  Star, 
  Clock, 
  List,
  ChevronRight,
  FileText 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { makeWatchlist } from '@/stubs/fixtures';
import { useQuickActions } from './QuickActionsContext';
import { useOffline } from '@/components/offline';
import type { SymbolItem } from './types';

// Local storage key for recent symbols - per spec
const RECENTS_KEY = 'sparkfined_symbol_recents_v1';
const MAX_RECENTS = 12; // Per spec: cap 12

function getRecentSymbols(): SymbolItem[] {
  try {
    const stored = localStorage.getItem(RECENTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function normalizeSymbolKey(value: string): string {
  return value.trim().toLowerCase();
}

function addRecentSymbol(symbol: SymbolItem) {
  try {
    // Dedupe (trim + case-insensitive) + move-to-top (per spec)
    const key = normalizeSymbolKey(symbol.symbol);
    const recents = getRecentSymbols().filter((s) => normalizeSymbolKey(s.symbol) !== key);
    recents.unshift({ ...symbol, symbol: symbol.symbol.trim(), isRecent: true });
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Symbol type heuristic per spec:
 * - len >= 32 and no spaces → Contract
 * - else → Ticker
 */
function getSymbolType(symbol: string): 'contract' | 'ticker' {
  return symbol.length >= 32 && !symbol.includes(' ') ? 'contract' : 'ticker';
}

interface SymbolPickerProps {
  onSelect?: (symbol: SymbolItem, action: 'chart' | 'replay' | 'alert' | 'journal') => void;
  onBack?: () => void;
  showBackButton?: boolean;
  className?: string;
}

export function SymbolPicker({ onSelect, onBack, showBackButton = true, className }: SymbolPickerProps) {
  const navigate = useNavigate();
  const { close } = useQuickActions();
  const { isOnline, markQueued } = useOffline();
  const [search, setSearch] = React.useState('');
  const [expandedSymbol, setExpandedSymbol] = React.useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  
  // Get watchlist and recents
  const watchlist = React.useMemo(() => {
    // Prefer existing watchlist local source if present (per spec).
    try {
      const stored = localStorage.getItem('sparkfined_watchlist_v1');
      if (stored) {
        const parsed = JSON.parse(stored) as Array<{ symbol: string; name?: string }>;
        return parsed
          .filter((w) => typeof w?.symbol === 'string' && w.symbol.trim())
          .slice(0, 24)
          .map((w) => ({
            symbol: w.symbol.trim(),
            name: (w.name || w.symbol).trim(),
            isWatchlist: true,
          }));
      }
    } catch {
      // ignore
    }

    // BACKEND_TODO: wire SymbolPicker watchlist to backend source of truth
    return makeWatchlist(8).map((w) => ({
      symbol: w.symbol,
      name: w.name,
      isWatchlist: true,
    }));
  }, []);
  
  const recents = React.useMemo(() => getRecentSymbols(), []);
  
  // Filter symbols based on search
  const filteredSymbols = React.useMemo(() => {
    const allSymbols: SymbolItem[] = [];
    
    // Add recents first
    recents.forEach((s) => {
      if (!allSymbols.find((x) => normalizeSymbolKey(x.symbol) === normalizeSymbolKey(s.symbol))) {
        allSymbols.push({ ...s, isRecent: true });
      }
    });
    
    // Add watchlist
    watchlist.forEach((s) => {
      if (!allSymbols.find((x) => normalizeSymbolKey(x.symbol) === normalizeSymbolKey(s.symbol))) {
        allSymbols.push(s);
      } else {
        // Mark as both
        const existing = allSymbols.find((x) => normalizeSymbolKey(x.symbol) === normalizeSymbolKey(s.symbol));
        if (existing) existing.isWatchlist = true;
      }
    });
    
    if (!search) return allSymbols;
    
    const term = search.toLowerCase();
    return allSymbols.filter(
      (s) =>
        s.symbol.toLowerCase().includes(term) ||
        s.name.toLowerCase().includes(term)
    );
  }, [recents, watchlist, search]);

  // Flat list for keyboard navigation
  const flatSymbolList = React.useMemo(() => {
    const list: SymbolItem[] = [];
    if (!search && recents.length > 0) {
      list.push(...recents);
    }
    filteredSymbols
      .filter((s) => s.isWatchlist && (!search || !s.isRecent))
      .forEach((s) => {
        if (!list.find((x) => normalizeSymbolKey(x.symbol) === normalizeSymbolKey(s.symbol))) {
          list.push(s);
        }
      });
    return list;
  }, [filteredSymbols, recents, search]);

  // Reset selection on search change
  React.useEffect(() => {
    setSelectedIndex(-1);
    setExpandedSymbol(null);
  }, [search]);

  // Keyboard navigation
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < flatSymbolList.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        const symbol = flatSymbolList[selectedIndex];
        if (symbol) {
          if (expandedSymbol === symbol.symbol) {
            // If already expanded, trigger default action (chart)
            handleAction(symbol, 'chart');
          } else {
            setExpandedSymbol(symbol.symbol);
          }
        }
      } else if (e.key === 'Escape') {
        if (expandedSymbol) {
          setExpandedSymbol(null);
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, flatSymbolList, expandedSymbol]);

  // Scroll selected item into view
  React.useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-symbol-row]');
      const item = items[selectedIndex];
      if (item) {
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);
  
  const handleAction = React.useCallback((symbol: SymbolItem, action: 'chart' | 'replay' | 'alert' | 'journal') => {
    addRecentSymbol(symbol);
    
    // Handle offline state
    if (!isOnline) {
      markQueued(`${action} action for ${symbol.symbol}`);
    }
    
    if (onSelect) {
      onSelect(symbol, action);
      return;
    }
    
    // Default navigation behavior per spec
    switch (action) {
      case 'chart':
        navigate(`/research?q=${encodeURIComponent(symbol.symbol)}`);
        break;
      case 'replay':
        navigate(`/research?q=${encodeURIComponent(symbol.symbol)}&replay=true`);
        break;
      case 'alert':
        navigate(`/alerts?symbol=${encodeURIComponent(symbol.symbol)}`);
        break;
      case 'journal':
        navigate('/journal');
        // BACKEND_TODO: prefill journal entry with selected symbol
        break;
    }
    
    close();
  }, [navigate, close, onSelect, isOnline, markQueued]);
  
  const handleSymbolClick = React.useCallback((symbol: SymbolItem, index: number) => {
    setSelectedIndex(index);
    if (expandedSymbol === symbol.symbol) {
      setExpandedSymbol(null);
    } else {
      setExpandedSymbol(symbol.symbol);
    }
  }, [expandedSymbol]);

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Search */}
      <div className="p-3 border-b border-border">
        {showBackButton && onBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="mb-2 -ml-2 text-muted-foreground"
          >
            ← Back to actions
          </Button>
        )}
        <Input
          ref={inputRef}
          placeholder="Search symbol..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9"
          autoFocus
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          ↑↓ to navigate, Enter to expand, Esc to close
        </p>
      </div>
      
      {/* Symbol List */}
      <ScrollArea className="flex-1 max-h-[300px]">
        <div ref={listRef} className="p-2">
          {/* Recents section */}
          {recents.length > 0 && !search && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground">
                <Clock className="h-3 w-3" />
                Recents
              </div>
              {recents.map((symbol, idx) => (
                <SymbolRow
                  key={`recent-${symbol.symbol}`}
                  symbol={symbol}
                  isExpanded={expandedSymbol === symbol.symbol}
                  isSelected={selectedIndex === idx}
                  onClick={() => handleSymbolClick(symbol, idx)}
                  onAction={(action) => handleAction(symbol, action)}
                  isOffline={!isOnline}
                />
              ))}
            </div>
          )}
          
          {/* Watchlist section */}
          {watchlist.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground">
                <List className="h-3 w-3" />
                Watchlist
              </div>
              {filteredSymbols
                .filter((s) => s.isWatchlist && (!search || !s.isRecent))
                .map((symbol, idx) => {
                  const globalIdx = search ? idx : recents.length + idx;
                  return (
                    <SymbolRow
                      key={`watch-${symbol.symbol}`}
                      symbol={symbol}
                      isExpanded={expandedSymbol === symbol.symbol}
                      isSelected={selectedIndex === globalIdx}
                      onClick={() => handleSymbolClick(symbol, globalIdx)}
                      onAction={(action) => handleAction(symbol, action)}
                      isOffline={!isOnline}
                    />
                  );
                })}
            </div>
          )}
          
          {filteredSymbols.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No symbols found
            </p>
          )}
        </div>
      </ScrollArea>
      
      {/* Offline indicator */}
      {!isOnline && (
        <div className="p-2 border-t border-border bg-warning/10">
          <p className="text-xs text-warning text-center">
            Offline — Actions will be queued
          </p>
        </div>
      )}
    </div>
  );
}

interface SymbolRowProps {
  symbol: SymbolItem;
  isExpanded: boolean;
  isSelected: boolean;
  onClick: () => void;
  onAction: (action: 'chart' | 'replay' | 'alert' | 'journal') => void;
  isOffline: boolean;
}

function SymbolRow({ symbol, isExpanded, isSelected, onClick, onAction, isOffline }: SymbolRowProps) {
  const symbolType = getSymbolType(symbol.symbol);
  
  return (
    <div className="mb-1" data-symbol-row>
      <button
        onClick={onClick}
        className={cn(
          'w-full flex items-center justify-between px-2 py-2 rounded-md text-left',
          'hover:bg-accent/50 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
          isExpanded && 'bg-accent/30',
          isSelected && 'bg-accent/20 ring-1 ring-brand/50'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate">{symbol.symbol}</span>
          <span className="text-xs text-muted-foreground truncate">{symbol.name}</span>
          {symbol.isFavorite && <Star className="h-3 w-3 text-warning fill-warning flex-shrink-0" />}
          {symbolType === 'contract' && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 flex-shrink-0">
              <FileText className="h-2.5 w-2.5 mr-0.5" />
              Contract
            </Badge>
          )}
        </div>
        <ChevronRight className={cn(
          'h-4 w-4 text-muted-foreground transition-transform flex-shrink-0',
          isExpanded && 'rotate-90'
        )} />
      </button>
      
      {/* Expanded actions */}
      {isExpanded && (
        <div className="flex gap-1 px-2 py-1.5 bg-muted/30 rounded-md ml-2 mr-2 mb-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8 text-xs min-h-[32px]"
            onClick={() => onAction('chart')}
          >
            <LineChart className="h-3.5 w-3.5 mr-1" />
            Chart
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8 text-xs min-h-[32px]"
            onClick={() => onAction('replay')}
          >
            <Play className="h-3.5 w-3.5 mr-1" />
            Replay
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8 text-xs min-h-[32px]"
            onClick={() => onAction('alert')}
          >
            <Bell className="h-3.5 w-3.5 mr-1" />
            Alert
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8 text-xs min-h-[32px]"
            onClick={() => onAction('journal')}
          >
            <BookOpen className="h-3.5 w-3.5 mr-1" />
            Journal
          </Button>
        </div>
      )}
    </div>
  );
}
