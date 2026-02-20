import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { InteractiveHelper } from '../components/InteractiveHelper';

const setLocationMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _k,
    i18n: { language: 'en' },
  }),
}));

vi.mock('wouter', () => ({
  useLocation: () => ['/dashboard', setLocationMock] as const,
}));

describe('InteractiveHelper', () => {
  it('can toggle open state repeatedly without crashing', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    const onOpenChange = vi.fn();

    root.render(<InteractiveHelper open={true} onOpenChange={onOpenChange} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(div.textContent).toContain('Interactive Helper');

    root.render(<InteractiveHelper open={false} onOpenChange={onOpenChange} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(div.textContent ?? '').not.toContain('Interactive Helper');

    root.render(<InteractiveHelper open={true} onOpenChange={onOpenChange} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(div.textContent).toContain('Interactive Helper');

    root.unmount();
    div.remove();
  });

  it('calls onOpenChange when close button is clicked', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    const onOpenChange = vi.fn();

    root.render(<InteractiveHelper open={true} onOpenChange={onOpenChange} />);
    await new Promise((r) => setTimeout(r, 0));

    const closeButton = div.querySelector('button[aria-label="Close helper"]');
    expect(closeButton).toBeTruthy();
    closeButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onOpenChange).toHaveBeenCalledWith(false);

    root.unmount();
    div.remove();
  });
});
