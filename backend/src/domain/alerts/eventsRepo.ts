import { getDatabase } from '../../db/index.js';
import type { AlertEmitted } from './types.js';

/**
 * Alert Events Repository
 * Handles persistence for alert emitted events
 */

export async function alertEventCreate(event: AlertEmitted): Promise<void> {
  const db = getDatabase();

  await db.prepare(`
    INSERT INTO alert_events_v1 (event_id, occurred_at, alert_id, payload_json)
    VALUES (?, ?, ?, ?)
  `).run(
    event.eventId,
    event.occurredAt,
    event.alertId,
    JSON.stringify(event)
  );
}

export async function alertEventsQuery(
  since?: string,
  limit = 100
): Promise<AlertEmitted[]> {
  const db = getDatabase();

  const sinceDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const rows = await db.prepare(`
    SELECT payload_json FROM alert_events_v1
    WHERE occurred_at > ?
    ORDER BY occurred_at ASC
    LIMIT ?
  `).all<{ payload_json: string }>(sinceDate, limit);

  return rows.map(row => JSON.parse(row.payload_json) as AlertEmitted);
}

export async function alertEventsCleanup(retentionDays = 30): Promise<number> {
  const db = getDatabase();

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const result = await db.prepare(`
    DELETE FROM alert_events_v1 WHERE occurred_at < ?
  `).run(cutoff);

  return result.changes;
}

export async function alertEventExists(eventId: string): Promise<boolean> {
  const db = getDatabase();

  const row = await db.prepare(`
    SELECT 1 FROM alert_events_v1 WHERE event_id = ? LIMIT 1
  `).get(eventId);

  return row !== undefined;
}
