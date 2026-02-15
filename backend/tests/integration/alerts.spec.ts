import { describe, it, expect, beforeEach } from 'vitest';
import {
  alertCreate,
  alertGetById,
  alertList,
  alertUpdate,
  alertCancelWatch,
  alertDelete,
} from '../../src/domain/alerts/repo';
import { alertEventCreate, alertEventsQuery } from '../../src/domain/alerts/eventsRepo';
import type { SimpleAlert, TwoStageAlert, DeadTokenAlert } from '../../src/domain/alerts/types';

describe('Alerts Integration', () => {
  describe('Create SIMPLE alert', () => {
    it('should create with correct defaults', async () => {
      const alert = await alertCreate({
        type: 'SIMPLE',
        symbolOrAddress: 'BTC',
        timeframe: '1h',
        condition: 'ABOVE',
        targetPrice: 50000,
      }) as SimpleAlert;
      
      expect(alert.id).toBeDefined();
      expect(alert.type).toBe('SIMPLE');
      expect(alert.symbolOrAddress).toBe('BTC');
      expect(alert.condition).toBe('ABOVE');
      expect(alert.targetPrice).toBe(50000);
      expect(alert.enabled).toBe(true);
      expect(alert.status).toBe('active');
      expect(alert.stage).toBe('WATCHING');
    });
  });
  
  describe('Create TWO_STAGE_CONFIRMED alert', () => {
    it('should create with indicators from template', async () => {
      const alert = await alertCreate({
        type: 'TWO_STAGE_CONFIRMED',
        symbolOrAddress: 'ETH',
        timeframe: '4h',
        template: 'TREND_MOMENTUM_STRUCTURE',
        expiryMinutes: 60,
        cooldownMinutes: 15,
      }) as TwoStageAlert;
      
      expect(alert.type).toBe('TWO_STAGE_CONFIRMED');
      expect(alert.template).toBe('TREND_MOMENTUM_STRUCTURE');
      expect(alert.indicators).toHaveLength(3);
      expect(alert.indicators[0].id).toBe('ema_cross');
      expect(alert.triggeredCount).toBe(0);
      expect(alert.expiresAt).toBeDefined();
    });
  });
  
  describe('Create DEAD_TOKEN_AWAKENING_V2 alert', () => {
    it('should create with params', async () => {
      const alert = await alertCreate({
        type: 'DEAD_TOKEN_AWAKENING_V2',
        symbolOrAddress: 'BONK',
        timeframe: '5m',
        params: {
          DEAD_VOL: 100,
          DEAD_TRADES: 5,
          DEAD_HOLDER_DELTA_6H: 0,
          AWAKE_VOL_MULT: 3,
          AWAKE_TRADES_MULT: 2,
          AWAKE_HOLDER_DELTA_30M: 5,
          STAGE2_WINDOW_MIN: 30,
          COOLDOWN_MIN: 15,
          STAGE3_WINDOW_H: 6,
          STAGE3_VOL_MULT: 2,
          STAGE3_TRADES_MULT: 1.5,
          STAGE3_HOLDER_DELTA: 10,
        },
      }) as DeadTokenAlert;
      
      expect(alert.type).toBe('DEAD_TOKEN_AWAKENING_V2');
      expect(alert.deadTokenStage).toBe('INITIAL');
      expect(alert.params.DEAD_VOL).toBe(100);
    });
  });
  
  describe('List', () => {
    beforeEach(async () => {
      await alertCreate({
        type: 'SIMPLE',
        symbolOrAddress: 'BTC',
        timeframe: '1h',
        condition: 'ABOVE',
        targetPrice: 50000,
      });
      
      await alertCreate({
        type: 'SIMPLE',
        symbolOrAddress: 'ETH',
        timeframe: '1h',
        condition: 'BELOW',
        targetPrice: 3000,
      });
    });
    
    it('should list all alerts', async () => {
      const alerts = await alertList();
      
      expect(alerts.length).toBe(2);
    });
    
    it('should filter by status', async () => {
      const active = await alertList('active');
      
      expect(active.length).toBe(2);
      expect(active.every(a => a.status === 'active')).toBe(true);
    });
    
    it('should filter by symbol', async () => {
      const btcAlerts = await alertList('all', 'BTC');
      
      expect(btcAlerts.length).toBe(1);
      expect(btcAlerts[0].symbolOrAddress).toBe('BTC');
    });
  });
  
  describe('Update', () => {
    it('should toggle enabled and update status', async () => {
      const alert = await alertCreate({
        type: 'SIMPLE',
        symbolOrAddress: 'BTC',
        timeframe: '1h',
        condition: 'ABOVE',
        targetPrice: 50000,
      });
      
      const updated = await alertUpdate(alert.id, { enabled: false });
      
      expect(updated?.enabled).toBe(false);
      expect(updated?.status).toBe('paused');
    });
    
    it('should update note', async () => {
      const alert = await alertCreate({
        type: 'SIMPLE',
        symbolOrAddress: 'BTC',
        timeframe: '1h',
        condition: 'ABOVE',
        targetPrice: 50000,
      });
      
      const updated = await alertUpdate(alert.id, { note: 'Important!' });
      
      expect(updated?.note).toBe('Important!');
    });
  });
  
  describe('Cancel Watch', () => {
    it('should set stage to CANCELLED', async () => {
      const alert = await alertCreate({
        type: 'TWO_STAGE_CONFIRMED',
        symbolOrAddress: 'ETH',
        timeframe: '4h',
        template: 'MACD_RSI_VOLUME',
        expiryMinutes: 60,
        cooldownMinutes: 15,
      });
      
      const cancelled = await alertCancelWatch(alert.id);
      
      expect(cancelled?.stage).toBe('CANCELLED');
      expect(cancelled?.enabled).toBe(false);
      expect(cancelled?.status).toBe('paused');
    });
  });
  
  describe('Delete', () => {
    it('should remove alert', async () => {
      const alert = await alertCreate({
        type: 'SIMPLE',
        symbolOrAddress: 'BTC',
        timeframe: '1h',
        condition: 'ABOVE',
        targetPrice: 50000,
      });
      
      const deleted = await alertDelete(alert.id);
      
      expect(deleted).toBe(true);
      expect(await alertGetById(alert.id)).toBeNull();
    });
  });
  
  describe('Events', () => {
    it('should create and query events', async () => {
      const event = {
        eventId: 'test-event-1',
        type: 'SIMPLE_TRIGGERED' as const,
        occurredAt: new Date().toISOString(),
        alertId: 'alert-1',
        alertType: 'SIMPLE' as const,
        symbolOrAddress: 'BTC',
        timeframe: '1h',
        stage: 'CONFIRMED' as const,
        status: 'triggered' as const,
        detail: {
          kind: 'simple' as const,
          condition: 'ABOVE' as const,
          targetPrice: 50000,
          lastPrice: 51000,
        },
      };
      
      await alertEventCreate(event);
      
      const events = await alertEventsQuery();
      
      expect(events.length).toBe(1);
      expect(events[0].eventId).toBe('test-event-1');
    });
    
    it('should query events since timestamp', async () => {
      const oldEvent = {
        eventId: 'old-event',
        type: 'SIMPLE_TRIGGERED' as const,
        occurredAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        alertId: 'alert-1',
        alertType: 'SIMPLE' as const,
        symbolOrAddress: 'BTC',
        timeframe: '1h',
        stage: 'CONFIRMED' as const,
        status: 'triggered' as const,
      };
      
      const newEvent = {
        eventId: 'new-event',
        type: 'SIMPLE_TRIGGERED' as const,
        occurredAt: new Date().toISOString(),
        alertId: 'alert-2',
        alertType: 'SIMPLE' as const,
        symbolOrAddress: 'ETH',
        timeframe: '1h',
        stage: 'CONFIRMED' as const,
        status: 'triggered' as const,
      };
      
      await alertEventCreate(oldEvent);
      await alertEventCreate(newEvent);
      
      const since = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
      const events = await alertEventsQuery(since);
      
      expect(events.length).toBe(1);
      expect(events[0].eventId).toBe('new-event');
    });
  });
});
