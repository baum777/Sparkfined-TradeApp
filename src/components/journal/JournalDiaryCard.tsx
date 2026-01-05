import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Edit3,
  Archive,
  Smile,
  Meh,
  Frown,
  Zap,
  AlertTriangle,
} from "lucide-react";
import type { JournalEntryLocal } from "@/services/journal/types";
import { cn } from "@/lib/utils";

interface JournalDiaryCardProps {
  entry: JournalEntryLocal;
  onEdit?: () => void;
  onArchive?: () => void;
}

export function JournalDiaryCard({
  entry,
  onEdit,
  onArchive,
}: JournalDiaryCardProps) {
  // Stub data - would come from actual entry
  const feeling: "confident" | "neutral" | "uncertain" | "fomo" | "fearful" = entry.id.includes("1")
    ? "confident"
    : entry.id.includes("2")
    ? "uncertain"
    : "neutral";
  const confidence = entry.id.includes("1") ? 75 : entry.id.includes("3") ? 45 : 60;

  type FeelingType = "confident" | "neutral" | "uncertain" | "fomo" | "fearful";
  
  const getFeelingConfig = (f: FeelingType) => {
    const configs: Record<FeelingType, { icon: typeof Smile; label: string; className: string }> = {
      confident: { icon: Smile, label: "Confident", className: "text-emerald-500" },
      uncertain: { icon: Frown, label: "Uncertain", className: "text-amber-500" },
      fomo: { icon: Zap, label: "FOMO", className: "text-amber-500" },
      fearful: { icon: AlertTriangle, label: "Fearful", className: "text-red-500" },
      neutral: { icon: Meh, label: "Neutral", className: "text-muted-foreground" },
    };
    return configs[f];
  };

  const feelingConfig = getFeelingConfig(feeling);
  const FeelingIcon = feelingConfig.icon;

  return (
    <Card
      data-testid="journal-card-diary"
      className={cn(
        "relative bg-surface border-border/50 rounded-xl",
        "hover:border-border hover:shadow-md transition-all"
      )}
    >
      {/* Left accent - gradient for diary */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-gradient-to-b from-primary to-accent" />

      <CardContent className="p-4 pl-5">
        {/* Feeling prominent */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              "bg-muted"
            )}
          >
            <FeelingIcon className={cn("h-5 w-5", feelingConfig.className)} />
          </div>
          <div>
            <span className={cn("font-medium", feelingConfig.className)}>
              {feelingConfig.label}
            </span>
            <div className="text-xs text-muted-foreground">
              Confidence: {confidence}%
            </div>
          </div>
        </div>

        {/* Reasoning */}
        <p className="text-sm text-foreground/90 line-clamp-3 mb-3">
          {entry.summary}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge variant="outline" className="text-xs">
            market-analysis
          </Badge>
          <Badge variant="outline" className="text-xs">
            pre-session
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onEdit && (
            <Button
              data-testid="journal-diary-edit"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Edit3 className="h-4 w-4 mr-1.5" />
              Edit
            </Button>
          )}
          {onArchive && (
            <Button
              data-testid="journal-diary-archive"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onArchive();
              }}
              className="text-muted-foreground hover:text-destructive"
            >
              <Archive className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
