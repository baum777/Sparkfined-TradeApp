import { describe, expect, it } from 'vitest';
import { mobileNavItems } from '@/config/navigation';

describe('Mobile navigation', () => {
  it('exposes only the reduced primary tab set', () => {
    const testIds = mobileNavItems.map((item) => item.testId);

    expect(testIds).toEqual([
      'tab-dashboard',
      'tab-research',
      'tab-journal',
      'tab-insights',
      'tab-terminal',
    ]);
  });

  it('does not show Alerts or Settings in bottom navigation', () => {
    const testIds = mobileNavItems.map((item) => item.testId);

    expect(testIds).not.toContain('tab-alerts');
    expect(testIds).not.toContain('tab-settings');
  });
});
