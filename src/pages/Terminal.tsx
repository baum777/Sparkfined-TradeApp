import { PageContainer } from '@/components/layout/PageContainer';
import { TerminalShell } from '@/components/terminal/TerminalShell';

export default function Terminal() {
  return (
    <PageContainer data-testid="page-terminal">
      <TerminalShell />
    </PageContainer>
  );
}

