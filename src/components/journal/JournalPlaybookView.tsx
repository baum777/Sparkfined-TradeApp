/**
 * JournalPlaybookView
 * Handbook content integrated into Journal as ?mode=playbook
 * Migrated from standalone /handbook route
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, BookMarked, FileText, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface HandbookSection {
  id: string;
  title: string;
  description: string;
  items: { id: string; title: string; completed: boolean }[];
}

const HANDBOOK_SECTIONS: HandbookSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Essential setup and first steps",
    items: [
      { id: "intro", title: "Introduction to Trading", completed: true },
      { id: "setup", title: "Account Setup", completed: true },
      { id: "first-trade", title: "Your First Trade", completed: false },
    ],
  },
  {
    id: "risk-management",
    title: "Risk Management",
    description: "Protect your capital",
    items: [
      { id: "position-sizing", title: "Position Sizing", completed: false },
      { id: "stop-loss", title: "Stop Loss Strategies", completed: false },
      { id: "risk-reward", title: "Risk-Reward Ratios", completed: false },
    ],
  },
  {
    id: "technical-analysis",
    title: "Technical Analysis",
    description: "Chart patterns and indicators",
    items: [
      { id: "support-resistance", title: "Support & Resistance", completed: false },
      { id: "trend-lines", title: "Trend Lines", completed: false },
      { id: "indicators", title: "Key Indicators", completed: false },
      { id: "candlesticks", title: "Candlestick Patterns", completed: false },
    ],
  },
  {
    id: "psychology",
    title: "Trading Psychology",
    description: "Master your emotions",
    items: [
      { id: "discipline", title: "Discipline & Patience", completed: false },
      { id: "fomo", title: "Avoiding FOMO", completed: false },
      { id: "losses", title: "Handling Losses", completed: false },
    ],
  },
];

export function JournalPlaybookSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
              <Skeleton className="h-4 w-56" />
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PlaybookEmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <Card className="py-12">
      <CardContent className="flex flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <BookMarked className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">
          No playbook content
        </h3>
        <p className="mb-4 max-w-sm text-sm text-muted-foreground">
          Your trading playbook is empty. Content will appear here once available.
        </p>
        <Button onClick={onRefresh}>Refresh</Button>
        {/* BACKEND HOOK (unchanged): Fetch user handbook entries and strategies */}
      </CardContent>
    </Card>
  );
}

interface JournalPlaybookViewProps {
  isLoading?: boolean;
  isEmpty?: boolean;
  onRefresh?: () => void;
}

export function JournalPlaybookView({
  isLoading = false,
  isEmpty = false,
  onRefresh,
}: JournalPlaybookViewProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter sections by search
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return HANDBOOK_SECTIONS;

    const query = searchQuery.toLowerCase();
    return HANDBOOK_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          section.title.toLowerCase().includes(query)
      ),
    })).filter(
      (section) =>
        section.items.length > 0 ||
        section.title.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleRefresh = () => {
    onRefresh?.();
  };

  if (isLoading) {
    return <JournalPlaybookSkeleton />;
  }

  if (isEmpty) {
    return <PlaybookEmptyState onRefresh={handleRefresh} />;
  }

  return (
    <div data-testid="journal-playbook" className="space-y-6">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search playbook..."
          className="pl-10"
        />
      </div>

      {/* Sections */}
      {filteredSections.length === 0 ? (
        <Card className="py-8">
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              No sections match your search.
            </p>
            <Button
              variant="link"
              onClick={() => setSearchQuery("")}
              className="mt-2"
            >
              Clear search
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {filteredSections.map((section) => {
            const completedCount = section.items.filter((i) => i.completed).length;
            const totalCount = section.items.length;

            return (
              <AccordionItem
                key={section.id}
                value={section.id}
                className="border rounded-lg px-4 bg-card"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex flex-1 items-center justify-between pr-4">
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{section.title}</span>
                        <Badge variant="secondary" className="text-xs">
                          {completedCount}/{totalCount}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {section.description}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-2 pt-2">
                    {section.items.map((item) => (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 transition-colors",
                          "hover:bg-secondary/50 cursor-pointer"
                        )}
                      >
                        {item.completed ? (
                          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span
                            className={cn(
                              "text-sm",
                              item.completed
                                ? "text-foreground"
                                : "text-muted-foreground"
                            )}
                          >
                            {item.title}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* BACKEND HOOK (unchanged): Fetch handbook entries and link to detailed views */}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
