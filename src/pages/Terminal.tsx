import { PageContainer } from '@/components/layout/PageContainer';
import { TerminalShell } from '@/components/terminal/TerminalShell';
import { ErrorBoundary } from '@/components/system/ErrorBoundary';
import { useDiscoverStore } from '@/lib/state/discoverStore';

export default function Terminal() {
  const closeOverlay = useDiscoverStore((s) => s.closeOverlay);

  const handleReset = () => {
    // Close Discover overlay if open
    closeOverlay();
  };

  return (
    <ErrorBoundary scope="Terminal" onReset={handleReset}>
      <PageContainer data-testid="page-terminal">
        <TerminalShell />
      </PageContainer>
    </ErrorBoundary>
  );
}

