import { Router } from './http/router.js';
import {
  handleHealth,
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

  // Trading (Terminal + Discover)
  router.get('/quote', handleQuote);
  router.post('/swap', handleSwap);
  router.get('/discover/tokens', handleDiscoverTokens);

  // Auth (cookie-backed)
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
  router.put('/oracle/read-state', handleOracleReadState);
  router.post('/oracle/read-state/bulk', handleOracleBulkReadState);
  // Alias: allow PUT as well as POST (contract allows POST/PUT).
  router.put('/oracle/read-state/bulk', handleOracleBulkReadState);
  
  // Chart TA Route
  router.post('/chart/ta', handleTAAnalysis);
  // SOL Chart Analysis (JSON+Text) with Phase-2 onchain gating
  router.post('/chart/analyze', handleChartAnalyze);

  // Reasoning Routes
  router.post('/reasoning/trade-review', handleReasoningTradeReview);
  router.post('/reasoning/session-review', handleReasoningSessionReview);
  router.post('/reasoning/board-scenarios', handleReasoningBoardScenarios);
  router.post('/reasoning/insight-critic', handleReasoningInsightCritic);
  router.post('/reasoning/route', handleReasoningRoute);

  // LLM Execute (router + provider)
  router.post('/llm/execute', handleLlmExecute);

  // Canonical Feeds & Signals (Theme Group 5)
  router.get('/feed/oracle', handleFeedOracle);
  router.get('/feed/pulse', handleFeedPulse);
  router.get('/signals/unified', handleSignalsUnified);

  // Market Aliases
  router.get('/market/daily-bias', handleMarketDailyBias);
  
  return router;
}
