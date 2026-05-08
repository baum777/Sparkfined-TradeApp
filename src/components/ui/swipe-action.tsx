/**
 * Swipe Action Component
 * Swipe-to-reveal actions on list items with undo support
 * Per Mobiles Gesten-Konzept
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SWIPE_THRESHOLD = 80; // px to trigger action
const SNAP_THRESHOLD = 40; // px to reveal action buttons

interface SwipeAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'destructive';
  onAction: () => void | Promise<void>;
  undoable?: boolean;
  undoLabel?: string;
}

interface SwipeActionProps {
  children: React.ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  className?: string;
  disabled?: boolean;
}

export function SwipeAction({
  children,
  leftActions = [],
  rightActions = [],
  className,
  disabled = false,
}: SwipeActionProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [translateX, setTranslateX] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const startX = React.useRef<number | null>(null);
  const startY = React.useRef<number | null>(null);
  const isHorizontalSwipe = React.useRef<boolean | null>(null);
  
  // Respect prefers-reduced-motion
  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false;
  
  const handlePointerDown = React.useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    
    startX.current = e.clientX;
    startY.current = e.clientY;
    isHorizontalSwipe.current = null;
    setIsDragging(true);
    
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [disabled]);
  
  const handlePointerMove = React.useCallback((e: React.PointerEvent) => {
    if (startX.current === null || startY.current === null || disabled) return;
    
    const deltaX = e.clientX - startX.current;
    const deltaY = e.clientY - startY.current;
    
    // Determine swipe direction on first significant move
    if (isHorizontalSwipe.current === null) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
      return;
    }
    
    if (!isHorizontalSwipe.current) return;
    
    // Calculate bounded translation
    const maxLeft = leftActions.length > 0 ? SWIPE_THRESHOLD * leftActions.length : 0;
    const maxRight = rightActions.length > 0 ? SWIPE_THRESHOLD * rightActions.length : 0;
    
    const bounded = Math.max(-maxRight, Math.min(maxLeft, deltaX));
    setTranslateX(bounded);
  }, [disabled, leftActions.length, rightActions.length]);

  const executeAction = React.useCallback(async (action: SwipeAction) => {
    if (action.undoable) {
      // Show undo toast for destructive actions
      let undone = false;
      
      toast(action.label, {
        description: action.undoLabel || 'Action completed',
        action: {
          label: 'Undo',
          onClick: () => {
            undone = true;
          },
        },
        duration: 5000,
        onDismiss: () => {
          if (!undone) {
            action.onAction();
          }
        },
      });
    } else {
      await action.onAction();
    }
    
    setTranslateX(0);
  }, []);
  
  const handlePointerUp = React.useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    setIsDragging(false);
    
    if (startX.current === null) return;
    
    const deltaX = e.clientX - startX.current;
    
    // Check if action should trigger
    if (Math.abs(deltaX) >= SWIPE_THRESHOLD) {
      if (deltaX > 0 && leftActions.length > 0) {
        executeAction(leftActions[0]);
      } else if (deltaX < 0 && rightActions.length > 0) {
        executeAction(rightActions[0]);
      }
    }
    
    // Snap back or to reveal position
    const shouldReveal = Math.abs(translateX) >= SNAP_THRESHOLD;
    if (shouldReveal && Math.abs(translateX) < SWIPE_THRESHOLD) {
      const revealAmount = translateX > 0 ? SNAP_THRESHOLD : -SNAP_THRESHOLD;
      setTranslateX(revealAmount);
    } else {
      setTranslateX(0);
    }
    
    startX.current = null;
    startY.current = null;
    isHorizontalSwipe.current = null;
  }, [executeAction, leftActions, rightActions, translateX]);
  
  const handleActionClick = React.useCallback((action: SwipeAction) => {
    executeAction(action);
  }, [executeAction]);
  
  return (
    <div 
      ref={containerRef}
      className={cn('relative overflow-hidden touch-pan-y', className)}
    >
      {/* Left actions (revealed when swiping right) */}
      {leftActions.length > 0 && (
        <div className="absolute inset-y-0 left-0 flex">
          {leftActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleActionClick(action)}
              className={cn(
                'flex items-center justify-center px-4 min-w-[80px] text-sm font-medium',
                action.variant === 'destructive' 
                  ? 'bg-destructive text-destructive-foreground' 
                  : 'bg-primary text-primary-foreground'
              )}
              aria-label={action.label}
            >
              {action.icon || action.label}
            </button>
          ))}
        </div>
      )}
      
      {/* Right actions (revealed when swiping left) */}
      {rightActions.length > 0 && (
        <div className="absolute inset-y-0 right-0 flex">
          {rightActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleActionClick(action)}
              className={cn(
                'flex items-center justify-center px-4 min-w-[80px] text-sm font-medium',
                action.variant === 'destructive' 
                  ? 'bg-destructive text-destructive-foreground' 
                  : 'bg-primary text-primary-foreground'
              )}
              aria-label={action.label}
            >
              {action.icon || action.label}
            </button>
          ))}
        </div>
      )}
      
      {/* Main content */}
      <div
        className={cn(
          'relative bg-background',
          !isDragging && !prefersReducedMotion && 'transition-transform duration-200'
        )}
        style={{ transform: `translateX(${translateX}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {children}
      </div>
    </div>
  );
}
