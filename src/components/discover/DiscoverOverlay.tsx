import { useEffect } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import { useDiscoverStore } from '@/lib/state/discoverStore';
import { discoverService } from '@/lib/discover/discoverService';
import { DiscoverHeader } from './DiscoverHeader';
import { DiscoverTabs } from './DiscoverTabs';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DiscoverOverlay() {
  const isOpen = useDiscoverStore((s) => s.isOpen);
  const closeOverlay = useDiscoverStore((s) => s.closeOverlay);
  const setTokens = useDiscoverStore((s) => s.setTokens);
  const setLoading = useDiscoverStore((s) => s.setLoading);
  const setError = useDiscoverStore((s) => s.setError);

  // Fetch tokens when overlay opens
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(null);
      discoverService
        .getTokens()
        .then((tokens) => {
          setTokens(tokens);
          setLoading(false);
        })
        .catch((error) => {
          setError(error instanceof Error ? error.message : 'Failed to load tokens');
          setLoading(false);
        });
    }
  }, [isOpen, setTokens, setLoading, setError]);

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && closeOverlay()}>
      <DrawerContent
        role="dialog"
        aria-label="Discover Tokens"
        data-testid="discover-dialog"
        className="h-[90vh] max-h-[90vh]"
      >
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <DrawerTitle>Discover Tokens</DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
          <DiscoverHeader />
        </DrawerHeader>
        <div className="flex-1 overflow-hidden">
          <DiscoverTabs />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

