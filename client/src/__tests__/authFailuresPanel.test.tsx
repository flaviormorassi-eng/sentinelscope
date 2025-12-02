import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { AuthFailuresPanel } from '../components/security/AuthFailuresPanel';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => {
    if (k.startsWith('authFailures.headers.')) return k.split('.').pop();
    if (k.startsWith('threats.severityLevels.')) return k.split('.').pop();
    return k;
  } })
}));

// Mock auth context
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'admin-user' } })
}));

// Mock react-query useQuery
vi.mock('@tanstack/react-query', async (orig: any) => {
  const actual: any = await orig();
  return {
    ...actual,
    useQuery: (opts: any) => {
      const key: string = opts.queryKey?.[0] || '';
      if (key.startsWith('/api/user/')) {
        return { data: { isAdmin: true }, isLoading: false, isError: false };
      }
      if (key.startsWith('/api/compliance/audit-logs')) {
        return {
          data: [
            { id: '1', timestamp: new Date().toISOString(), status: 'failure', action: 'missing_token', eventType: 'login_failed', eventCategory: 'authentication', severity: 'high', ipAddress: '10.0.0.1' },
            { id: '2', timestamp: new Date(Date.now() - 20000).toISOString(), status: 'failure', action: 'internal_error', eventType: 'login_failed', eventCategory: 'authentication', severity: 'low', ipAddress: '10.0.0.2' }
          ],
          isLoading: false,
          isError: false,
        };
      }
      return { data: undefined, isLoading: false, isError: false };
    }
  };
});

describe('AuthFailuresPanel sorting', () => {
  it('sorts by timestamp desc initially and toggles to action on header click', async () => {
    const qc = new QueryClient();
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    root.render(<QueryClientProvider client={qc}><AuthFailuresPanel /></QueryClientProvider>);

  // Wait a tick for React effects
  await new Promise(r => setTimeout(r, 0));
  let rows = Array.from(div.querySelectorAll('tbody tr'));
  // Filter only data rows with multiple cells
  rows = rows.filter(r => r.querySelectorAll('td').length >= 5);
  expect(rows.length).toBeGreaterThan(0);
  expect(rows[0].textContent).toMatch(/Missing Token/);

    // Click Action header to sort by action (ascending)
    const actionHeader = Array.from(div.querySelectorAll('th')).find(th => th.textContent === 'action');
    expect(actionHeader).toBeTruthy();
    actionHeader!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // Re-evaluate first row after sort
  await new Promise(r => setTimeout(r, 0));
  let rowsAfter = Array.from(div.querySelectorAll('tbody tr'));
  rowsAfter = rowsAfter.filter(r => r.querySelectorAll('td').length >= 5);
  expect(rowsAfter[0].textContent).toMatch(/Auth Internal Error/);
  });
});
