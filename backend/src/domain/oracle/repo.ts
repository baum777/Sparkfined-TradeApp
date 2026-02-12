import { getDatabase } from '../../db/index.js';
import type {
  OracleDailyFeed,
  OracleReadState,
} from './types.js';
import { generateDailyFeed, getDateString } from './generator.js';

/**
 * Oracle Repository
 * Handles persistence for daily feeds and read states
 */

export async function oracleGetDaily(date: Date, userId: string): Promise<OracleDailyFeed> {
  const dateStr = getDateString(date);
  const db = getDatabase();

  // Try to get cached daily feed
  const cached = await db.prepare(`
    SELECT payload_json FROM oracle_daily_v1 WHERE date = ?
  `).get<{ payload_json: string }>(dateStr);

  let feed: OracleDailyFeed;
  
  if (cached) {
    feed = JSON.parse(cached.payload_json) as OracleDailyFeed;
  } else {
    // Generate new feed and cache it
    feed = generateDailyFeed(dateStr);
    
    await db.prepare(`
      INSERT OR REPLACE INTO oracle_daily_v1 (date, payload_json, created_at)
      VALUES (?, ?, ?)
    `).run(dateStr, JSON.stringify(feed), new Date().toISOString());
  }

  // Apply user's read states
  const readStates = await getReadStatesForUser(userId);
  
  feed.pinned.isRead = readStates.get(feed.pinned.id) ?? false;
  
  feed.insights = feed.insights.map(insight => ({
    ...insight,
    isRead: readStates.get(insight.id) ?? false,
  }));
  
  return feed;
}

async function getReadStatesForUser(userId: string): Promise<Map<string, boolean>> {
  const db = getDatabase();

  const rows = await db
    .prepare(`
      SELECT id, is_read FROM oracle_read_state_v1 WHERE user_id = ?
    `)
    .all<{ id: string; is_read: number }>(userId);

  const map = new Map<string, boolean>();
  for (const row of rows) {
    map.set(row.id, row.is_read === 1);
  }
  
  return map;
}

export async function oracleSetReadState(
  userId: string,
  id: string,
  isRead: boolean
): Promise<OracleReadState> {
  const db = getDatabase();
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT OR REPLACE INTO oracle_read_state_v1 (user_id, id, is_read, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(userId, id, isRead ? 1 : 0, now);

  return {
    id,
    isRead,
    updatedAt: now,
  };
}

export async function oracleBulkSetReadState(
  userId: string,
  ids: string[],
  isRead: boolean
): Promise<OracleReadState[]> {
  const db = getDatabase();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO oracle_read_state_v1 (user_id, id, is_read, updated_at)
    VALUES (?, ?, ?, ?)
  `);

  const results: OracleReadState[] = [];

  await db.transaction(async () => {
    for (const id of ids) {
      await stmt.run(userId, id, isRead ? 1 : 0, now);
      results.push({
        id,
        isRead,
        updatedAt: now,
      });
    }
  });

  return results;
}

export async function oracleClearOldDaily(retentionDays = 7): Promise<number> {
  const db = getDatabase();

  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const cutoffStr = getDateString(cutoffDate);

  const result = await db.prepare(`
    DELETE FROM oracle_daily_v1 WHERE date < ?
  `).run(cutoffStr);

  return result.changes;
}
