import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Clipboard, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandList,
  CommandItem,
} from "@/components/ui/command";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { routeHelpers } from "@/routes/routes";
import { parseResearchChartQuery } from "@/utils/researchQuery";

// ============ LocalStorage helpers ============
const RECENTS_KEY = "sparkfined_recent_searches_v1";
const RECENTS_MAX = 8;

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function saveRecents(recents: string[]) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
  } catch {
    // ignore
  }
}

function upsertRecent(recents: string[], value: string): string[] {
  const v = value.trim();
  if (!v) return recents;

  const lower = v.toLowerCase();
  const filtered = recents.filter((r) => r.toLowerCase() !== lower);
  const next = [v, ...filtered].slice(0, RECENTS_MAX);
  return next;
}

function inferKind(value: string): "Ticker" | "Contract" | "Unknown" {
  const parsed = parseResearchChartQuery(value);
  if (parsed.kind === "ticker") return "Ticker";
  if (parsed.kind === "address") return "Contract";
  return "Unknown";
}

// ============ Quick chips config ============
const QUICK_CHIPS = ["SOL", "BONK", "JUP", "WIF"];

export function GlobalSearchBar() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isClipboardLoading, setIsClipboardLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load recents on mount
  useEffect(() => {
    setRecents(loadRecents());
  }, []);

  // Outside click handler
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  // Unified search handler
  const doSearch = useCallback(
    (raw?: string) => {
      const input = (raw ?? query).trim();
      if (!input) return;

      const parsed = parseResearchChartQuery(input);
      if (parsed.kind === "invalid") {
        setValidationError(
          "Invalid query: expected ticker (1–15, A-Z/0-9/._-) or Solana-like address (32–44)."
        );
        // Ensure the escape-hatch CTA is clickable (recents dropdown can overlay it).
        setIsOpen(false);
        setHighlightedIndex(-1);
        return;
      }

      const valueToNavigate = parsed.normalized;

      // Clear validation error on successful search
      setValidationError(null);

      setRecents((prev) => {
        const next = upsertRecent(prev, valueToNavigate);
        saveRecents(next);
        return next;
      });

      setIsOpen(false);
      setQuery("");

      // Navigate to Research workspace with query
      navigate(routeHelpers.research({ q: valueToNavigate }));
    },
    [query, navigate]
  );

  const handleSearchAnyway = useCallback(() => {
    const raw = query.trim();
    if (!raw) return;

    setValidationError(null);

    setRecents((prev) => {
      const next = upsertRecent(prev, raw);
      saveRecents(next);
      return next;
    });

    setIsOpen(false);
    setQuery("");

    // Escape hatch: bypass strict validation only; still use canonical navigation path.
    navigate(routeHelpers.research({ q: raw }));
  }, [navigate, query]);

  // Clipboard button handler
  const handleClipboard = async () => {
    setIsClipboardLoading(true);
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (trimmed) {
        setQuery(trimmed);
        doSearch(trimmed);
      } else {
        toast({
          title: "Clipboard empty",
          description: "No text found in clipboard.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Clipboard access denied",
        description: "Unable to read clipboard.",
        variant: "destructive",
      });
    } finally {
      setIsClipboardLoading(false);
    }
  };

  // Clear recents
  const clearRecents = () => {
    setRecents([]);
    saveRecents([]);
  };

  // Keyboard handling
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < recents.length) {
        const selected = recents[highlightedIndex];
        setQuery(selected);
        doSearch(selected);
      } else {
        doSearch();
      }
      return;
    }

    if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightedIndex(-1);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < recents.length - 1 ? prev + 1 : prev
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      return;
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setValidationError(null); // Clear error on input change
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleRecentSelect = (item: string) => {
    setQuery(item);
    setValidationError(null);
    doSearch(item);
  };

  const handleChipClick = (chip: string) => {
    setQuery(chip);
    setValidationError(null);
    doSearch(chip);
  };

  return (
    <div ref={rootRef} className="w-full space-y-3">
      {/* Search input row */}
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search token or paste contract..."
            value={query}
            onChange={handleInputChange}
            aria-invalid={!!validationError}
            aria-describedby={validationError ? "search-error" : undefined}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            className="pl-10 pr-10 h-11 bg-background border-border"
            aria-label="Search token or contract"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Clipboard button */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleClipboard}
          disabled={isClipboardLoading}
          className="h-11 w-11 shrink-0"
          aria-label="Paste from clipboard"
        >
          {isClipboardLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Clipboard className="h-4 w-4" />
          )}
        </Button>

        {/* Search button */}
        <Button
          type="button"
          onClick={() => doSearch()}
          disabled={!query.trim()}
          className="h-11 px-4 shrink-0"
        >
          Search
        </Button>

        {/* Recents dropdown */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 z-50 mt-2 rounded-md border bg-popover shadow-md">
            <Command>
              <CommandList>
                {recents.length === 0 ? (
                  <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                    No recent searches yet
                  </div>
                ) : (
                  recents.map((item, index) => (
                    <CommandItem
                      key={item}
                      value={item}
                      onSelect={() => handleRecentSelect(item)}
                      className={cn(
                        "cursor-pointer",
                        highlightedIndex === index && "bg-accent"
                      )}
                    >
                      <span className="flex-1 truncate">{item}</span>
                      <Badge variant="secondary" className="ml-2 shrink-0">
                        {inferKind(item)}
                      </Badge>
                    </CommandItem>
                  ))
                )}
              </CommandList>

              {recents.length > 0 && (
                <div className="flex items-center justify-between border-t px-2 py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearRecents}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear recents
                  </Button>
                </div>
              )}
            </Command>
          </div>
        )}
      </div>

      {/* Validation error */}
      {validationError && (
        <div className="flex items-center justify-between gap-3">
          <p id="search-error" className="text-sm text-destructive" role="alert">
            {validationError}
          </p>
          {!!query.trim() && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={handleSearchAnyway}
              className="h-auto px-0 text-sm"
            >
              Search anyway
            </Button>
          )}
        </div>
      )}

      {/* Quick chips */}
      <div className="flex flex-wrap gap-2">
        {QUICK_CHIPS.map((chip) => (
          <Button
            key={chip}
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => handleChipClick(chip)}
            className="h-7 px-3 text-xs font-medium focus-visible:ring-2 focus-visible:ring-brand"
          >
            {chip}
          </Button>
        ))}
      </div>
    </div>
  );
}
