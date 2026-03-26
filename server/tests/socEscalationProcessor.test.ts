import { describe, it, expect, beforeEach, vi } from 'vitest';

const storageMock = {
  getOverdueSocCases: vi.fn(),
  getSocCaseEvents: vi.fn(),
  createSocCaseEvent: vi.fn(),
  createAlert: vi.fn(),
  createSecurityAuditLog: vi.fn(),
};

vi.mock('../storage', () => ({ storage: storageMock }));

describe('runSocEscalationProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('escalates overdue cases once and emits timeline + alert', async () => {
    storageMock.getOverdueSocCases.mockResolvedValue([
      {
        id: 'case-1',
        userId: 'u1',
        incidentId: 'ev-1',
        caseStatus: 'open',
        slaDueAt: new Date(Date.now() - 60_000).toISOString(),
      },
    ]);
    storageMock.getSocCaseEvents.mockResolvedValue([]);

    const { runSocEscalationProcessor } = await import('../socEscalationProcessor');
    const count = await runSocEscalationProcessor();

    expect(count).toBe(1);
    expect(storageMock.createSocCaseEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      incidentId: 'ev-1',
      eventType: 'sla_breached',
    }));
    expect(storageMock.createAlert).toHaveBeenCalled();
  });

  it('skips case when sla_breached event already exists', async () => {
    storageMock.getOverdueSocCases.mockResolvedValue([
      {
        id: 'case-1',
        userId: 'u1',
        incidentId: 'ev-1',
        caseStatus: 'in_progress',
        slaDueAt: new Date(Date.now() - 60_000).toISOString(),
      },
    ]);
    storageMock.getSocCaseEvents.mockResolvedValue([
      { id: 'evt-1', eventType: 'sla_breached' },
    ]);

    const { runSocEscalationProcessor } = await import('../socEscalationProcessor');
    const count = await runSocEscalationProcessor();

    expect(count).toBe(0);
    expect(storageMock.createSocCaseEvent).not.toHaveBeenCalled();
    expect(storageMock.createAlert).not.toHaveBeenCalled();
  });
});
