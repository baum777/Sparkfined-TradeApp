import { PageContainer } from '@/components/layout/PageContainer';
import { TerminalShell } from '@/components/terminal/TerminalShell';
import { ErrorBoundary } from '@/components/system/ErrorBoundary';
import { useDiscoverStore } from '@/lib/state/discoverStore';

export default function TradingShell() {
  const closeOverlay = useDiscoverStore((s) => s.closeOverlay);

  const handleReset = () => {
    closeOverlay();
  };

  return (
    <ErrorBoundary scope="TradingTerminal" onReset={handleReset}>
      <PageContainer testId="trading-terminal">
        <TerminalShell />
      </PageContainer>
    </ErrorBoundary>
  );
}
