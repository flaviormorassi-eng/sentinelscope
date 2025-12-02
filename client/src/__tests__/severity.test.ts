import { describe, it, expect } from 'vitest';
import { normalizeSeverity, getSeverityConfig } from '../lib/severity';

describe('severity utils', () => {
  it('normalizes mixed-case inputs', () => {
    expect(normalizeSeverity('HIGH')).toBe('high');
    expect(normalizeSeverity('Critical')).toBe('critical');
    expect(normalizeSeverity('medium')).toBe('medium');
  });

  it('defaults to low on null/unknown', () => {
    expect(normalizeSeverity(null as any)).toBe('low');
    expect(normalizeSeverity(undefined as any)).toBe('low');
    expect(normalizeSeverity('unknown' as any)).toBe('low');
  });

  it('returns config with matching label', () => {
    const cfg = getSeverityConfig('medium');
    expect(cfg.label).toBe('medium');
    expect(cfg).toHaveProperty('variant');
    expect(cfg).toHaveProperty('icon');
  });
});
