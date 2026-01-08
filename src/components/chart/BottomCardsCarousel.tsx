import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Lightbulb, BookOpen } from "lucide-react";
import type { OracleStub } from "@/stubs/contracts";
import type { JournalEntryLocal } from "@/services/journal/types";

interface BottomCardsCarouselProps {
  oracleInsights: OracleStub[];
  journalNotes: JournalEntryLocal[];
}

export function BottomCardsCarousel({
  oracleInsights,
  journalNotes,
}: BottomCardsCarouselProps) {
  const navigate = useNavigate();
  const [section, setSection] = useState<"oracle" | "journal">("oracle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const items = section === "oracle" ? oracleInsights : journalNotes;
  const itemCount = items.length;

  // Reset index when switching sections
  useEffect(() => {
    setCurrentIndex(0);
  }, [section]);

  // Wrap-around navigation
  const goNext = useCallback(() => {
    if (itemCount === 0) return;
    setCurrentIndex((prev) => (prev + 1) % itemCount);
  }, [itemCount]);

  const goPrev = useCallback(() => {
    if (itemCount === 0) return;
    setCurrentIndex((prev) => (prev - 1 + itemCount) % itemCount);
  }, [itemCount]);

  // Touch/swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Only trigger if horizontal movement is dominant and exceeds threshold
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0) {
        goNext();
      } else {
        goPrev();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  const renderOracleCard = (insight: OracleStub, isActive: boolean) => (
    <Card
      className={`shrink-0 w-[85%] transition-all duration-300 ${
        isActive ? "opacity-100 scale-100" : "opacity-40 scale-95"
      }`}
    >
      <CardContent className="p-4 h-[200px] flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary shrink-0" />
            <h4 className="font-medium text-sm line-clamp-1">{insight.title}</h4>
          </div>
          <Badge variant="outline" className="shrink-0 text-xs">
            {insight.theme}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-3 flex-1">
          {insight.summary}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-2">
          {new Date(insight.createdAt).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );

  const renderJournalCard = (entry: JournalEntryLocal, isActive: boolean) => (
    <Card
      className={`shrink-0 w-[85%] transition-all duration-300 ${
        isActive ? "opacity-100 scale-100" : "opacity-40 scale-95"
      }`}
    >
      <CardContent className="p-4 h-[200px] flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary shrink-0" />
          </div>
          <Badge variant="outline" className="shrink-0 text-xs capitalize">
            {entry.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-4 flex-1">
          {entry.summary}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-2">
          {new Date(entry.timestamp).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center h-[200px] text-center px-4">
      {section === "oracle" ? (
        <>
          <Lightbulb className="h-8 w-8 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">No insights yet</p>
        </>
      ) : (
        <>
          <BookOpen className="h-8 w-8 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No notes yet</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/journal")}>
            Go to Journal
          </Button>
        </>
      )}
    </div>
  );

  // Get visible items with peek (current, next peek)
  const getVisibleCards = () => {
    if (itemCount === 0) return [];
    
    const visible: { item: typeof items[0]; index: number; isActive: boolean }[] = [];
    
    // Current card
    visible.push({ item: items[currentIndex], index: currentIndex, isActive: true });
    
    // Next card (peek)
    if (itemCount > 1) {
      const nextIndex = (currentIndex + 1) % itemCount;
      visible.push({ item: items[nextIndex], index: nextIndex, isActive: false });
    }
    
    return visible;
  };

  return (
    <div className="space-y-3">
      {/* Section tabs */}
      <div className="flex items-center justify-between">
        <ToggleGroup
          type="single"
          value={section}
          onValueChange={(v) => v && setSection(v as "oracle" | "journal")}
          className="bg-muted/50 rounded-md p-0.5"
        >
          <ToggleGroupItem
            value="oracle"
            className="text-xs px-3 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm"
          >
            Oracle
          </ToggleGroupItem>
          <ToggleGroupItem
            value="journal"
            className="text-xs px-3 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm"
          >
            Journal Notes
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Desktop navigation buttons */}
        {itemCount > 1 && (
          <div className="hidden sm:flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goPrev}
              aria-label="Previous card"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
              {currentIndex + 1} / {itemCount}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goNext}
              aria-label="Next card"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Carousel viewport */}
      <div
        ref={containerRef}
        className="relative overflow-hidden"
        aria-label={`${section === "oracle" ? "Oracle insights" : "Journal notes"} carousel`}
        role="region"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {itemCount === 0 ? (
          renderEmptyState()
        ) : (
          <div className="flex gap-3 transition-transform duration-300">
            {getVisibleCards().map(({ item, index, isActive }) => (
              <div key={`${section}-${index}`}>
                {section === "oracle"
                  ? renderOracleCard(item as OracleStub, isActive)
                  : renderJournalCard(item as JournalEntryLocal, isActive)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mobile dots indicator */}
      {itemCount > 1 && (
        <div className="flex justify-center gap-1.5 sm:hidden">
          {items.map((_, i) => (
            <button
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentIndex ? "bg-primary" : "bg-muted-foreground/30"
              }`}
              onClick={() => setCurrentIndex(i)}
              aria-label={`Go to card ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
