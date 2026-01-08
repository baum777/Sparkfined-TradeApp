import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LessonStub } from "@/stubs/contracts";

interface LessonCardProps {
  lesson: LessonStub;
  onLockedClick: (lesson: LessonStub) => void;
}

const difficultyColors: Record<LessonStub["difficulty"], string> = {
  easy: "bg-success/10 text-success border-success/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  hard: "bg-destructive/10 text-destructive border-destructive/20",
};

const difficultyLabels: Record<LessonStub["difficulty"], string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export function LessonCard({ lesson, onLockedClick }: LessonCardProps) {
  const navigate = useNavigate();

  const handleOpen = () => {
    if (lesson.locked) {
      onLockedClick(lesson);
    } else {
      navigate(`/journal?mode=learn`);
      // Lesson viewer integrated into Journal Learn mode
    }
  };

  return (
    <Card
      className={cn(
        "flex flex-col transition-all hover:border-primary/50 hover:shadow-md",
        lesson.locked && "opacity-70"
      )}
    >
      <CardContent className="flex flex-1 flex-col p-4">
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn("text-xs capitalize", difficultyColors[lesson.difficulty])}
            >
              {difficultyLabels[lesson.difficulty]}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {lesson.category}
            </Badge>
            {lesson.locked && (
              <Badge
                variant="outline"
                className="border-muted-foreground/30 text-muted-foreground text-xs"
              >
                <Lock className="mr-1 h-3 w-3" />
                Locked
              </Badge>
            )}
          </div>
          <h3 className="font-medium text-foreground leading-tight">
            {lesson.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {lesson.description}
          </p>
        </div>

        {!lesson.locked && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{lesson.progress}%</span>
            </div>
            <Progress value={lesson.progress} className="h-1.5" />
          </div>
        )}

        <div className="mt-4">
          <Button
            onClick={handleOpen}
            variant={lesson.locked ? "outline" : "default"}
            size="sm"
            className="w-full"
          >
            {lesson.locked ? (
              <>
                <Lock className="mr-1.5 h-3.5 w-3.5" />
                Locked
              </>
            ) : (
              "Open"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
