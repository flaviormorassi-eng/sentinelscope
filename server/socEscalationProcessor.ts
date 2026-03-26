import { storage } from './storage';

const ESCALATION_BATCH_SIZE = 200;

function isOpenStatus(status: string | null | undefined): boolean {
  return status === 'open' || status === 'in_progress';
}

async function escalateCaseIfNeeded(socCase: any): Promise<boolean> {
  const incidentId = String(socCase?.incidentId || '');
  const userId = String(socCase?.userId || '');
  if (!incidentId || !userId) return false;

  if (!isOpenStatus(String(socCase?.caseStatus || 'open'))) {
    return false;
  }

  const timeline = await storage.getSocCaseEvents(userId, incidentId, 50);
  const alreadyEscalated = (timeline || []).some((event: any) => event?.eventType === 'sla_breached');
  if (alreadyEscalated) {
    return false;
  }

  const dueAtIso = socCase?.slaDueAt ? new Date(socCase.slaDueAt).toISOString() : null;
  const nowIso = new Date().toISOString();

  await storage.createSocCaseEvent({
    userId,
    incidentId,
    eventType: 'sla_breached',
    actorId: null,
    fromValue: dueAtIso,
    toValue: nowIso,
    metadata: {
      reason: 'sla_due_time_passed',
      caseStatus: socCase?.caseStatus || 'open',
    },
  } as any);

  await storage.createAlert({
    userId,
    title: 'SOC SLA Breach Escalation',
    message: `Case for incident ${incidentId} exceeded SLA and was escalated.`,
    severity: 'high',
    read: false,
  } as any);

  try {
    await storage.createSecurityAuditLog({
      userId,
      eventType: 'SOC_SLA_BREACH',
      eventCategory: 'THREAT_MANAGEMENT',
      action: 'soc_case_sla_breached',
      resourceType: 'soc_case',
      resourceId: incidentId,
      status: 'success',
      severity: 'high',
      details: {
        slaDueAt: dueAtIso,
        escalatedAt: nowIso,
      },
      metadata: null,
    } as any);
  } catch {
  }

  return true;
}

export async function runSocEscalationProcessor(): Promise<number> {
  try {
    const overdueCases = await storage.getOverdueSocCases(ESCALATION_BATCH_SIZE);
    if (!overdueCases || overdueCases.length === 0) {
      return 0;
    }

    let escalated = 0;
    for (const socCase of overdueCases) {
      try {
        const didEscalate = await escalateCaseIfNeeded(socCase);
        if (didEscalate) escalated += 1;
      } catch (error) {
        console.error('[SocEscalation] Failed to process case', socCase?.id, error);
      }
    }

    return escalated;
  } catch (error) {
    console.error('[SocEscalation] Cycle failure', error);
    return 0;
  }
}
