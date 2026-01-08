import { Router } from './http/router.js';
import {
  handleHealth,
  handleMeta,
  handleJournalList,
  handleJournalGetById,
  handleJournalCreate,
  handleJournalConfirm,
  handleJournalArchive,
  handleJournalRestore,
  handleJournalDelete,
  handleAlertsList,
  handleAlertCreate,
  handleAlertGetById,
  handleAlertUpdate,
  handleAlertCancelWatch,
  handleAlertDelete,
  handleAlertEvents,
  handleOracleDaily,
  handleOracleReadState,
  handleOracleBulkReadState,
  handleTAAnalysis,
  handleReasoningTradeReview,
  handleReasoningSessionReview,
  handleReasoningBoardScenarios,
  handleReasoningInsightCritic,
  handleGrokPulseSnapshot,
  handleGrokPulseHistory,
  handleGrokPulseMeta,
  handleGrokPulseRun,
  handleUsageSummary,
  handleFeedOracle,
  handleFeedPulse,
  handleSignalsUnified,
  handleMarketDailyBias,
} from './routes/index.js';

/**
 * Application Router Setup
 * Registers all API routes
 */

export function createApp(): Router {
  const router = new Router('/api');
  
  // Health & Meta
  router.get('/health', handleHealth);
  router.get('/meta', handleMeta);
  router.get('/usage/summary', handleUsageSummary);
  
  // Journal Routes
  router.get('/journal', handleJournalList);
  router.get('/journal/:id', handleJournalGetById);
  router.post('/journal', handleJournalCreate);
  router.post('/journal/:id/confirm', handleJournalConfirm);
  router.post('/journal/:id/archive', handleJournalArchive);
  router.post('/journal/:id/restore', handleJournalRestore);
  router.delete('/journal/:id', handleJournalDelete);
  
  // Alert Routes
  router.get('/alerts', handleAlertsList);
  router.post('/alerts', handleAlertCreate);
  router.get('/alerts/:id', handleAlertGetById);
  router.patch('/alerts/:id', handleAlertUpdate);
  router.post('/alerts/:id/cancel-watch', handleAlertCancelWatch);
  router.delete('/alerts/:id', handleAlertDelete);
  router.get('/alerts/events', handleAlertEvents);
  
  // Oracle Routes
  router.get('/oracle/daily', handleOracleDaily);
  router.put('/oracle/read-state', handleOracleReadState);
  router.post('/oracle/read-state/bulk', handleOracleBulkReadState);
  
  // Chart TA Route
  router.post('/chart/ta', handleTAAnalysis);

  // Reasoning Routes
  router.post('/reasoning/trade-review', handleReasoningTradeReview);
  router.post('/reasoning/session-review', handleReasoningSessionReview);
  router.post('/reasoning/board-scenarios', handleReasoningBoardScenarios);
  router.post('/reasoning/insight-critic', handleReasoningInsightCritic);

  // Grok Pulse Routes
  router.get('/grok-pulse/snapshot/:address', handleGrokPulseSnapshot);
  router.get('/grok-pulse/history/:address', handleGrokPulseHistory);
  router.get('/grok-pulse/meta/last-run', handleGrokPulseMeta);
  router.post('/grok-pulse/run', handleGrokPulseRun);

  // Canonical Feeds & Signals (Theme Group 5)
  router.get('/feed/oracle', handleFeedOracle);
  router.get('/feed/pulse', handleFeedPulse);
  router.get('/signals/unified', handleSignalsUnified);

  // Market Aliases
  router.get('/market/daily-bias', handleMarketDailyBias);
  
  return router;
}
