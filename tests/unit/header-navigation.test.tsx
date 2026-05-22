// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { ALERTS_CHANGED_EVENT, dbService } from '@/services/db/db';

vi.mock('@/components/offline', () => ({
  OfflineStatusBadge: () => <div data-testid="offline-status-badge" />,
}));

vi.mock('@/components/quick-actions', () => ({
  QuickActionsHeaderButton: () => <button type="button">Quick Actions</button>,
}));

vi.mock('@/services/db/db', () => ({
  ALERTS_CHANGED_EVENT: 'alerts:changed',
  dbService: {
    getAllAlerts: vi.fn(async () => []),
  },
}));

describe('Header navigation', () => {
  beforeEach(() => {
    vi.mocked(dbService.getAllAlerts).mockReset();
    vi.mocked(dbService.getAllAlerts).mockResolvedValue([]);
  });

  it('exposes alerts via notifications action', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    const notificationsLink = screen.getByRole('link', { name: 'Notifications' });
    expect(notificationsLink).toHaveAttribute('href', '/alerts');
  });

  it('shows alerts badge when active or triggered alerts exist', async () => {
    vi.mocked(dbService.getAllAlerts).mockResolvedValueOnce([
      { id: 'a-1', enabled: true, status: 'active' } as any,
      { id: 'a-2', enabled: true, status: 'triggered' } as any,
      { id: 'a-3', enabled: true, status: 'paused' } as any,
      { id: 'a-4', enabled: false, status: 'active' } as any,
    ]);

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    const badge = await screen.findByTestId('header-alerts-badge');
    expect(badge).toHaveTextContent('2');
  });

  it('refreshes alerts badge when alerts changed event is emitted', async () => {
    vi.mocked(dbService.getAllAlerts)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'a-1', enabled: true, status: 'active' } as any,
      ]);

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('header-alerts-badge')).not.toBeInTheDocument();

    window.dispatchEvent(new Event(ALERTS_CHANGED_EVENT));

    await waitFor(() => {
      expect(screen.getByTestId('header-alerts-badge')).toHaveTextContent('1');
    });
  });
});
