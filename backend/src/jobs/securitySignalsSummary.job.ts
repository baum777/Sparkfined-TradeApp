import { logger } from '../observability/logger.js';
import { consumeSecuritySignalsSummary } from '../observability/securitySignals.js';

export interface SecuritySignalsSummaryJobResult {
  emitted: boolean;
  totalSignals: number;
}

export async function runSecuritySignalsSummaryJob(): Promise<SecuritySignalsSummaryJobResult> {
  const summary = consumeSecuritySignalsSummary();
  if (summary.totalSignals <= 0) {
    return { emitted: false, totalSignals: 0 };
  }

  logger.info('security.summary', summary as unknown as Record<string, unknown>);
  return { emitted: true, totalSignals: summary.totalSignals };
}
