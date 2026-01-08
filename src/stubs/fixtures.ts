import type {
  AlertStub,
  JournalEntryStub,
  LessonStub,
  WatchItemStub,
  OracleStub,
  DashboardMetricStub,
  RecentActivityStub,
  OverviewCardStub,
  NextActionStub,
  KpiTileStub,
} from './contracts';

// Stable base timestamp for deterministic data
const baseDate = new Date('2024-01-15T10:00:00.000Z');

function offsetDate(daysAgo: number): string {
  const date = new Date(baseDate);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

export function makeAlerts(count: number): AlertStub[] {
  const conditions = ['above', 'below', 'crosses'];
  const symbols = ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC'];
  const statuses: AlertStub['status'][] = ['active', 'paused', 'triggered'];

  return Array.from({ length: count }, (_, i) => ({
    id: `alert-${i + 1}`,
    symbol: symbols[i % symbols.length],
    condition: conditions[i % conditions.length],
    targetPrice: 40000 + i * 1000,
    status: statuses[i % statuses.length],
    createdAt: offsetDate(i),
  }));
}

export function makeJournalEntries(count: number): JournalEntryStub[] {
  const sides: JournalEntryStub['side'][] = ['BUY', 'SELL'];
  const statuses: JournalEntryStub['status'][] = ['pending', 'confirmed', 'archived'];
  const summaries = [
    'Strong breakout above resistance with volume confirmation',
    'Took profit at key resistance level',
    'Entered on pullback to support zone',
    'Cut loss quickly after failed breakout',
    'Swing trade setup on daily chart',
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: `entry-${i + 1}`,
    side: sides[i % sides.length],
    status: statuses[i % statuses.length],
    timestamp: offsetDate(i),
    summary: summaries[i % summaries.length],
  }));
}

export function makeLessons(count: number): LessonStub[] {
  const difficulties: LessonStub['difficulty'][] = ['easy', 'medium', 'hard'];
  const categories = ['Basics', 'Risk', 'Mindset', 'System'];
  const lessons = [
    { title: 'Introduction to Chart Patterns', description: 'Learn the foundational chart patterns every trader should know.' },
    { title: 'Understanding Support & Resistance', description: 'Master key price levels that drive market decisions.' },
    { title: 'Candlestick Formations 101', description: 'Decode candlestick signals for better entry timing.' },
    { title: 'Risk-Reward Ratios Explained', description: 'Calculate and optimize your risk-to-reward on every trade.' },
    { title: 'Managing Trading Emotions', description: 'Build mental frameworks to stay disciplined under pressure.' },
    { title: 'Volume Analysis Fundamentals', description: 'Use volume to confirm trends and spot reversals early.' },
    { title: 'Trend Following Strategies', description: 'Ride momentum with proven trend-following techniques.' },
    { title: 'Position Sizing Mastery', description: 'Size positions correctly to protect capital and maximize gains.' },
    { title: 'Building a Trading System', description: 'Create a repeatable system that fits your style and goals.' },
    { title: 'Journaling for Improvement', description: 'Track and analyze trades to accelerate your growth.' },
    { title: 'Breakout Trading Essentials', description: 'Identify and trade breakouts with confidence.' },
    { title: 'The Psychology of Loss', description: 'Handle losses constructively and avoid revenge trading.' },
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: `lesson-${i + 1}`,
    title: lessons[i % lessons.length].title,
    description: lessons[i % lessons.length].description,
    difficulty: difficulties[i % difficulties.length],
    category: categories[i % categories.length],
    locked: i > 2,
    progress: i < 2 ? Math.min(100, (i + 1) * 40) : 0,
  }));
}

export function makeWatchlist(count: number): WatchItemStub[] {
  const items = [
    { symbol: 'BTC', name: 'Bitcoin' },
    { symbol: 'ETH', name: 'Ethereum' },
    { symbol: 'SOL', name: 'Solana' },
    { symbol: 'AVAX', name: 'Avalanche' },
    { symbol: 'MATIC', name: 'Polygon' },
    { symbol: 'LINK', name: 'Chainlink' },
    { symbol: 'DOT', name: 'Polkadot' },
    { symbol: 'ATOM', name: 'Cosmos' },
  ];

  return Array.from({ length: Math.min(count, items.length) }, (_, i) => ({
    id: `watch-${i + 1}`,
    symbol: items[i].symbol,
    name: items[i].name,
  }));
}

export function makeOracle(count: number): OracleStub[] {
  const themes = ['bullish', 'bearish', 'neutral', 'caution'];
  const insights = [
    { title: 'Market Momentum Shift', summary: 'Key indicators suggest a potential trend reversal in the next 48 hours.' },
    { title: 'Volume Divergence Alert', summary: 'Unusual volume patterns detected across major pairs.' },
    { title: 'Support Level Test', summary: 'Critical support zone approaching - watch for reaction.' },
    { title: 'Breakout Potential', summary: 'Consolidation pattern nearing completion with bullish bias.' },
    { title: 'Risk-Off Signal', summary: 'Correlation with traditional markets increasing.' },
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: `oracle-${i + 1}`,
    title: insights[i % insights.length].title,
    summary: insights[i % insights.length].summary,
    theme: themes[i % themes.length],
    isRead: i < 2,
    createdAt: offsetDate(i),
  }));
}

export function makeDashboardMetrics(): DashboardMetricStub[] {
  return [
    { id: 'metric-1', label: 'Win Rate', value: '64%', change: 2.5, trend: 'up' },
    { id: 'metric-2', label: 'Total Trades', value: '127', change: 12, trend: 'up' },
    { id: 'metric-3', label: 'Avg R:R', value: '2.4', change: -0.1, trend: 'down' },
    { id: 'metric-4', label: 'Streak', value: '5W', trend: 'neutral' },
  ];
}

export function makeRecentActivity(count: number): RecentActivityStub[] {
  const activities = [
    { type: 'trade' as const, title: 'BTC Long Closed', description: '+2.4R profit on breakout' },
    { type: 'alert' as const, title: 'ETH Alert Triggered', description: 'Price crossed $2,400' },
    { type: 'lesson' as const, title: 'Lesson Completed', description: 'Risk Management 101' },
    { type: 'trade' as const, title: 'SOL Short Entry', description: 'Entered at resistance' },
    { type: 'alert' as const, title: 'New Alert Created', description: 'BTC below $42,000' },
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: `activity-${i + 1}`,
    type: activities[i % activities.length].type,
    title: activities[i % activities.length].title,
    description: activities[i % activities.length].description,
    timestamp: offsetDate(i),
  }));
}

export function makeOverviewCards(): OverviewCardStub[] {
  return [
    {
      id: 'overview-today',
      type: 'today',
      title: 'Today',
      summary: 'Market analysis ready',
      badge: 'New',
      link: '/insights',
    },
    {
      id: 'overview-alerts',
      type: 'alerts',
      title: 'Alerts',
      summary: '2 triggered today',
      count: 5,
      link: '/alerts',
    },
    {
      id: 'overview-journal',
      type: 'journal',
      title: 'Journal',
      summary: '3 pending, 12 confirmed',
      count: 15,
      link: '/journal',
    },
  ];
}

export function makeNextActions(): NextActionStub[] {
  return [
    {
      id: 'action-1',
      title: 'Review pending entries',
      description: 'You have 3 trades awaiting review',
      link: '/journal?mode=inbox',
      priority: 'high',
    },
    {
      id: 'action-2',
      title: 'Create an alert',
      description: 'Set up price alerts for your watchlist',
      link: '/alerts',
      priority: 'medium',
    },
  ];
}

export function makeKpiTiles(): KpiTileStub[] {
  return [
    { id: 'kpi-1', label: 'Win Rate', value: '64%', change: 2.5, trend: 'up', tooltip: 'Percentage of profitable trades over the last 30 days' },
    { id: 'kpi-2', label: 'Total Trades', value: '127', change: 12, trend: 'up', tooltip: 'Total number of trades recorded this month' },
    { id: 'kpi-3', label: 'Avg R:R', value: '2.4', change: -0.1, trend: 'down', tooltip: 'Average risk-to-reward ratio across all trades' },
    { id: 'kpi-4', label: 'Streak', value: '5W', trend: 'neutral', tooltip: 'Current winning streak' },
    { id: 'kpi-5', label: 'P&L', value: '+$2,450', change: 8.2, trend: 'up', tooltip: 'Total profit/loss this month' },
  ];
}
