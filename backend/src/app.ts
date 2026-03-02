import { Router } from './http/router.js';
import {
  handleHealth,
  handleHealthReady,
  handleHealthUpstreams,
  handleMeta,
  handleAuthRegister,
  handleAuthLogin,
  handleAuthRefresh,
  handleAuthLogout,
  handleAuthMe,
  handleJournalList,
  handleJournalGetById,
  handleJournalCreate,
  handleJournalConfirm,
  handleJournalArchive,
  handleJournalRestore,
  handleJournalDelete,
  handleJournalInsights,
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
  handleChartAnalyze,
  handleReasoningTradeReview,
  handleReasoningSessionReview,
  handleReasoningBoardScenarios,
  handleReasoningInsightCritic,
  handleUsageSummary,
  handleFeedOracle,
  handleFeedPulse,
  handleSignalsUnified,
  handleMarketDailyBias,
  handleReasoningRoute,
  handleLlmExecute,
  handleSettingsGet,
  handleSettingsPatch,
  handleQuote,
  handleSwap,
  handleDiscoverTokens,
} from './routes/index.js';
import { getEnv } from './config/env.js';

/**
 * Application Router Setup
 * Registers API routes based on SERVICE_MODE
 * - terminal: only trading routes
 * - journal: only journal/llm routes
 * - full: all routes
 */

export function createApp(): Router {
  const router = new Router('/api');
  const env = getEnv();
  const mode = env.SERVICE_MODE;

  // Health & Meta (always available)
  router.get('/health', handleHealth);
  router.get('/health/ready', handleHealthReady);
  router.get('/health/upstreams', handleHealthUpstreams);
  router.get('/meta', handleMeta);
  router.get('/usage/summary', handleUsageSummary);

  // TERMINAL MODE: Trading routes
  if (mode === 'terminal' || mode === 'full') {
    router.get('/quote', handleQuote);
    router.post('/swap', handleSwap);
    router.get('/discover/tokens', handleDiscoverTokens);
  }

  // JOURNAL MODE: Journal, LLM, Auth, Settings routes
  if (mode === 'journal' || mode === 'full') {
    // Auth
    router.post('/auth/register', handleAuthRegister);
    router.post('/auth/login', handleAuthLogin);
    router.post('/auth/refresh', handleAuthRefresh);
    router.post('/auth/logout', handleAuthLogout);
    router.get('/auth/me', handleAuthMe);

    // Settings
    router.get('/settings', handleSettingsGet);
    router.patch('/settings', handleSettingsPatch);

    // Journal Routes
    router.get('/journal', handleJournalList);
    router.get('/journal/:id', handleJournalGetById);
    router.post('/journal', handleJournalCreate);
    router.post('/journal/:id/insights', handleJournalInsights);
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
    router.get('/oracle/read-state', handleOracleReadState);
    router.put('/oracle/read-state', handleOracleBulkReadState);
    router.post('/oracle/read-state/bulk', handleOracleBulkReadState);
    router.put('/oracle/read-state/bulk', handleOracleBulkReadState);

    // Chart/TA Routes
    router.post('/chart/ta', handleTAAnalysis);
    router.post('/chart/analyze', handleChartAnalyze);

    // Reasoning Routes
    router.post('/reasoning/trade-review', handleReasoningTradeReview);
    router.post('/reasoning/session-review', handleReasoningSessionReview);
    router.post('/reasoning/board-scenarios', handleReasoningBoardScenarios);
    router.post('/reasoning/insight-critic', handleReasoningInsightCritic);
    router.post('/reasoning/route', handleReasoningRoute);

    // LLM Execute
    router.post('/llm/execute', handleLlmExecute);

    // Feeds
    router.get('/feed/oracle', handleFeedOracle);
    router.get('/feed/pulse', handleFeedPulse);
    router.get('/signals/unified', handleSignalsUnified);

    // Market
    router.get('/market/daily-bias', handleMarketDailyBias);
  }

  // 404 handler for disabled routes (only in non-full modes)
  if (mode !== 'full') {
    // This will be handled by the router's default notFound
    // Routes not registered above will naturally fall through to 404
  }

  return router;
}
