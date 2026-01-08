import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HelpCircle, ChevronRight, ExternalLink, Search } from "lucide-react";

// LocalStorage helpers
const RECENTS_KEY = "sparkfined_recent_markets_v1";
const RECENTS_MAX = 12;

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

interface MarketsBannerProps {
  selectedMarket: string;
  onSelectMarket: (symbol: string) => void;
  watchlistItems: { symbol: string; name: string }[];
}

export function MarketsBanner({
  selectedMarket,
  onSelectMarket,
  watchlistItems,
}: MarketsBannerProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"recently" | "watchlist">("recently");
  const [recents, setRecents] = useState<string[]>(() => loadRecents());
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Persist recents
  useEffect(() => {
    saveRecents(recents);
  }, [recents]);

  const handleSelectMarket = useCallback(
    (symbol: string) => {
      // Update recents
      setRecents((prev) => upsertRecent(prev, symbol));
      onSelectMarket(symbol);
      setMoreSheetOpen(false);
    },
    [onSelectMarket]
  );

  const currentList = tab === "recently" ? recents : watchlistItems.map((i) => i.symbol);

  // Filter for sheet
  const filteredList = searchQuery.trim()
    ? currentList.filter((s) =>
        s.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : currentList;

  return (
    <>
      <div className="p-3 bg-card/50 border border-border/50 rounded-lg space-y-3">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <ToggleGroup
            type="single"
            value={tab}
            onValueChange={(v) => v && setTab(v as "recently" | "watchlist")}
            className="bg-muted/50 rounded-md p-0.5"
          >
            <ToggleGroupItem
              value="recently"
              className="text-xs px-3 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              Recently
            </ToggleGroupItem>
            <ToggleGroupItem
              value="watchlist"
              className="text-xs px-3 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              Watchlist
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="text-sm">
                  Switch between your recently viewed markets and watchlist.
                  Click a ticker to load its chart.
                </p>
              </TooltipContent>
            </Tooltip>

            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => navigate("/research?panel=watchlist")}
            >
              Open Watchlist
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>

        {/* Chips row */}
        <div className="relative">
          <div
            ref={scrollRef}
            className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mb-1"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {currentList.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                {tab === "recently"
                  ? "No recent markets yet"
                  : "No watchlist items — add some"}
              </p>
            ) : (
              <>
                {currentList.slice(0, 8).map((symbol) => (
                  <Badge
                    key={symbol}
                    variant={selectedMarket === symbol ? "default" : "secondary"}
                    className="cursor-pointer shrink-0 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-brand"
                    tabIndex={0}
                    role="button"
                    onClick={() => handleSelectMarket(symbol)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectMarket(symbol);
                      }
                    }}
                  >
                    {symbol}
                  </Badge>
                ))}
                {currentList.length > 8 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-7 text-xs"
                    onClick={() => setMoreSheetOpen(true)}
                  >
                    More
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Empty CTA for watchlist */}
        {tab === "watchlist" && watchlistItems.length === 0 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => navigate("/research?panel=watchlist")}
          >
            Add to Watchlist
          </Button>
        )}
      </div>

      {/* More Sheet */}
      <Sheet open={moreSheetOpen} onOpenChange={setMoreSheetOpen}>
        <SheetContent side="bottom" className="h-[70vh] pb-20">
          <SheetHeader>
            <SheetTitle>
              {tab === "recently" ? "Recent Markets" : "Watchlist"}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search markets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-[calc(70vh-180px)]">
              <div className="space-y-1">
                {filteredList.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No markets found
                  </p>
                ) : (
                  filteredList.map((symbol) => (
                    <Button
                      key={symbol}
                      variant={selectedMarket === symbol ? "secondary" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => handleSelectMarket(symbol)}
                    >
                      <Badge variant="outline" className="mr-2">
                        {symbol}
                      </Badge>
                      {tab === "watchlist" &&
                        watchlistItems.find((i) => i.symbol === symbol)?.name}
                    </Button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
