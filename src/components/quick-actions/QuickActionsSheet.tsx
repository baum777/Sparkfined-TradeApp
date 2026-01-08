/**
 * Quick Actions Sheet (Mobile)
 * Bottom sheet with swipe-to-close
 * Per Global UI Infrastructure spec
 */

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  PenLine,
  LayoutDashboard,
  Lightbulb,
  Settings,
  X,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useQuickActions } from './QuickActionsContext';
import { useOffline } from '@/components/offline';
import { SymbolPicker } from './SymbolPicker';

export function QuickActionsSheet() {
  const navigate = useNavigate();
  const { isOpen, close, mode, setMode } = useQuickActions();
  const { isOnline } = useOffline();

  // Only show on mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  
  const handleNavigation = React.useCallback((path: string) => {
    navigate(path);
    close();
  }, [navigate, close]);

  const handleSymbolAction = React.useCallback(() => {
    setMode('symbol-picker');
  }, [setMode]);

  if (!isMobile) return null;

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && close()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left pb-2">
          <div className="flex items-center justify-between">
            <DrawerTitle>
              {mode === 'actions' ? 'Quick Actions' : 'Select Symbol'}
            </DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DrawerClose>
          </div>
          {mode === 'actions' && (
            <DrawerDescription>
              Jump to any action or page
            </DrawerDescription>
          )}
        </DrawerHeader>

        {mode === 'actions' ? (
          <div className="px-4 pb-6">
            {/* Primary Actions Grid */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <ActionButton
                icon={<Search className="h-5 w-5" />}
                label="Research"
                onClick={handleSymbolAction}
              />
              <ActionButton
                icon={<Bell className="h-5 w-5" />}
                label="Alert"
                onClick={() => handleNavigation('/alerts?create=true')}
              />
              <ActionButton
                icon={<PenLine className="h-5 w-5" />}
                label="Journal"
                onClick={() => handleNavigation('/journal?create=true')}
              />
              <ActionButton
                icon={<Settings className="h-5 w-5" />}
                label="Settings"
                onClick={() => handleNavigation('/settings')}
              />
            </div>

            {/* Navigation Links */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                Navigate
              </p>
              <NavButton
                icon={<LayoutDashboard className="h-4 w-4" />}
                label="Dashboard"
                onClick={() => handleNavigation('/dashboard')}
              />
              <NavButton
                icon={<Search className="h-4 w-4" />}
                label="Research"
                onClick={() => handleNavigation('/research')}
              />
              <NavButton
                icon={<PenLine className="h-4 w-4" />}
                label="Journal"
                onClick={() => handleNavigation('/journal')}
              />
              <NavButton
                icon={<Lightbulb className="h-4 w-4" />}
                label="Insights"
                onClick={() => handleNavigation('/insights')}
              />
              <NavButton
                icon={<Bell className="h-4 w-4" />}
                label="Alerts"
                onClick={() => handleNavigation('/alerts')}
              />
              <NavButton
                icon={<Settings className="h-4 w-4" />}
                label="Settings"
                onClick={() => handleNavigation('/settings')}
              />
            </div>

            {/* Offline indicator */}
            {!isOnline && (
              <div className="mt-4 p-2 rounded-md bg-warning/10 text-center">
                <p className="text-xs text-warning">
                  Offline — Actions will be queued
                </p>
              </div>
            )}
          </div>
        ) : (
          <SymbolPicker
            onBack={() => setMode('actions')}
            showBackButton
            className="pb-6"
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function ActionButton({ icon, label, onClick }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg',
        'bg-muted/50 hover:bg-muted transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        'min-h-[64px]'
      )}
    >
      <div className="text-primary">{icon}</div>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

interface NavButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function NavButton({ icon, label, onClick }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-md',
        'hover:bg-accent/50 transition-colors text-left',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        'min-h-[44px]'
      )}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
