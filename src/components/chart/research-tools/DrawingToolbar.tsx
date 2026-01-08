/**
 * Drawing Toolbar
 * Toolbar with drawing tools, undo/redo, and clear
 */

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Undo2, Redo2, Trash2 } from "lucide-react";
import { DRAWING_TOOLS } from "./constants";
import type { DrawingToolId } from "./types";

interface DrawingToolbarProps {
  activeTool: DrawingToolId;
  onToolChange: (tool: DrawingToolId) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  hasDrawings: boolean;
  elliottStep?: number;
}

export function DrawingToolbar({
  activeTool,
  onToolChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  hasDrawings,
  elliottStep,
}: DrawingToolbarProps) {
  const isElliottPlacing = activeTool === "elliott_5" && elliottStep !== undefined && elliottStep < 5;

  return (
    <div className="flex items-center justify-between gap-2 p-2 bg-card/50 border border-border/50 rounded-lg">
      <div className="flex items-center gap-1">
        {DRAWING_TOOLS.map((tool) => (
          <Tooltip key={tool.id}>
            <TooltipTrigger asChild>
              <Button
                variant={activeTool === tool.id ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => onToolChange(tool.id)}
                aria-label={tool.label}
                data-testid={tool.id === "elliott_5" ? "chart-tool-elliott-5" : undefined}
              >
                <tool.icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>
                {tool.label}
                {tool.shortcut && <span className="ml-2 text-muted-foreground">({tool.shortcut})</span>}
              </p>
            </TooltipContent>
          </Tooltip>
        ))}

        {/* Elliott Wave placement hint */}
        {isElliottPlacing && (
          <div 
            className="ml-2 px-2 py-1 text-xs bg-primary/10 text-primary rounded"
            data-testid="elliott-placement-step"
          >
            Place point {(elliottStep || 0) + 1} of 5
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Separator orientation="vertical" className="h-6 mx-1" />
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onUndo}
              disabled={!canUndo}
              aria-label="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Undo <span className="text-muted-foreground">(Ctrl+Z)</span></p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onRedo}
              disabled={!canRedo}
              aria-label="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Redo <span className="text-muted-foreground">(Ctrl+Y)</span></p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  disabled={!hasDrawings}
                  aria-label="Clear all drawings"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Clear all drawings</p>
            </TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all drawings?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove all drawings from the chart. This action can be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onClear}>Clear</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
