/**
 * Tools Tab: Library
 * Shows all available indicators organized by category
 */

import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Lock } from "lucide-react";
import { INDICATOR_LIBRARY, INDICATOR_CATEGORIES } from "./constants";
import type { IndicatorCategory } from "./types";

interface ToolsTabLibraryProps {
  onAddIndicator: (indicatorId: string) => void;
  enabledIndicatorIds: string[];
}

export function ToolsTabLibrary({ onAddIndicator, enabledIndicatorIds }: ToolsTabLibraryProps) {
  const getIndicatorsByCategory = (category: IndicatorCategory) => {
    return INDICATOR_LIBRARY.filter((i) => i.category === category);
  };

  return (
    <Accordion 
      type="multiple" 
      defaultValue={["trend", "momentum"]} 
      className="w-full"
    >
      {INDICATOR_CATEGORIES.map((category) => {
        const indicators = getIndicatorsByCategory(category.id as IndicatorCategory);
        if (indicators.length === 0) return null;

        return (
          <AccordionItem key={category.id} value={category.id}>
            <AccordionTrigger className="text-sm font-medium py-2">
              {category.label}
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-1 py-1">
                {indicators.map((indicator) => {
                  const isEnabled = enabledIndicatorIds.includes(indicator.id);
                  
                  return (
                    <div
                      key={indicator.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
                    >
                      <span className={`text-sm ${!indicator.supported ? "text-muted-foreground" : ""}`}>
                        {indicator.label}
                      </span>

                      {!indicator.supported ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled
                              aria-label="Not supported"
                            >
                              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Not supported by chart engine
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => onAddIndicator(indicator.id)}
                              aria-label={`Add ${indicator.label}`}
                            >
                              <Plus className={`h-3.5 w-3.5 ${isEnabled ? "text-primary" : ""}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isEnabled ? "Add another" : "Add to chart"}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
