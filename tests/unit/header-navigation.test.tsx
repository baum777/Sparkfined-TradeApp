// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { dbService } from '@/services/db/db';

vi.mock('@/components/offline', () => ({
  OfflineStatusBadge: () => <div data-testid="offline-status-badge" />,
}));

vi.mock('@/components/quick-actions', () => ({
  QuickActionsHeaderButton: () => <button type="button">Quick Actions</button>,
}));

vi.mock('@/services/db/db', () => ({
  dbService: {
    getAllAlerts: vi.fn(async () => []),
  },
}));

describe('Header navigation', () => {
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
});
