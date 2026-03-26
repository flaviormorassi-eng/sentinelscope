import OpenAI from 'openai';
import { z } from 'zod';
import type { Alert, Threat, ThreatEvent } from '@shared/schema';

export const aiThreatChatRequestSchema = z
  .object({
    message: z.string().trim().min(3).max(4000),
    language: z.enum(['en', 'pt']).optional().default('en'),
    threatId: z.string().trim().min(1).max(128).optional(),
    threatEventId: z.string().trim().min(1).max(128).optional(),
    alertId: z.string().trim().min(1).max(128).optional(),
    includeRecent: z.boolean().optional().default(true),
  })
  .strict();

export const aiThreatAssessmentSchema = z.object({
  summary: z.string().min(1).max(2000),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  confidence: z.number().int().min(0).max(100),
  recommendation: z.object({
    status: z.literal('awaiting_human_decision'),
    suggestedAction: z.enum(['block', 'allow', 'monitor', 'investigate']),
    reason: z.string().min(1).max(1200),
  }),
  evidence: z
    .array(
      z.object({
        label: z.string().min(1).max(120),
        detail: z.string().min(1).max(800),
        relevance: z.enum(['low', 'medium', 'high']),
      }),
    )
    .max(8),
  nextSteps: z.array(z.string().min(1).max(280)).max(6),
  constraints: z.array(z.string().min(1).max(280)).max(6),
  poweredByAi: z.boolean(),
});

type AiThreatAssessment = z.infer<typeof aiThreatAssessmentSchema>;
type AiThreatChatRequest = z.infer<typeof aiThreatChatRequestSchema>;

type ThreatContext = {
  request: AiThreatChatRequest;
  threat?: Threat;
  threatEvent?: ThreatEvent;
  alert?: Alert;
  recentThreats: Threat[];
  recentThreatEvents: ThreatEvent[];
  recentAlerts: Alert[];
};

function safeText(value: unknown, maxLen = 220): string {
  if (value === null || value === undefined) return '';
  const normalized = String(value).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized.slice(0, maxLen);
}

function compactThreat(threat: Threat) {
  return {
    id: threat.id,
    severity: safeText(threat.severity, 32),
    type: safeText(threat.type, 80),
    status: safeText(threat.status, 32),
    blocked: !!threat.blocked,
    sourceIP: safeText(threat.sourceIP, 64),
    targetIP: safeText(threat.targetIP, 64),
    sourceURL: safeText(threat.sourceURL, 200),
    threatVector: safeText(threat.threatVector, 120),
    description: safeText(threat.description, 280),
    timestamp: threat.timestamp ? new Date(threat.timestamp).toISOString() : null,
  };
}

function compactThreatEvent(event: ThreatEvent) {
  return {
    id: event.id,
    severity: safeText(event.severity, 32),
    threatType: safeText(event.threatType, 90),
    mitigationStatus: safeText(event.mitigationStatus, 32),
    autoBlocked: !!event.autoBlocked,
    confidence: Number(event.confidence) || 0,
    sourceURL: safeText(event.sourceURL, 200),
    threatVector: safeText(event.threatVector, 120),
    createdAt: event.createdAt ? new Date(event.createdAt).toISOString() : null,
  };
}

function compactAlert(alert: Alert) {
  return {
    id: alert.id,
    threatId: safeText(alert.threatId, 64),
    title: safeText(alert.title, 140),
    message: safeText(alert.message, 280),
    severity: safeText(alert.severity, 32),
    read: !!alert.read,
    timestamp: alert.timestamp ? new Date(alert.timestamp).toISOString() : null,
  };
}

function buildFallbackAssessment(context: ThreatContext): AiThreatAssessment {
  const hasCriticalSignal =
    safeText(context.threat?.severity || '').toLowerCase() === 'critical' ||
    safeText(context.threatEvent?.severity || '').toLowerCase() === 'critical' ||
    safeText(context.alert?.severity || '').toLowerCase() === 'critical';

  const riskLevel = hasCriticalSignal ? 'high' : 'medium';
  const suggestedAction = hasCriticalSignal ? 'investigate' : 'monitor';

  return {
    summary:
      context.request.language === 'pt'
        ? 'Avaliação inicial gerada sem modelo externo. Revise sinais de severidade, contexto de origem e histórico recente antes de decidir bloqueio ou liberação.'
        : 'Initial assessment generated without an external model. Review severity signals, source context, and recent history before deciding to block or allow.',
    riskLevel,
    confidence: hasCriticalSignal ? 72 : 58,
    recommendation: {
      status: 'awaiting_human_decision',
      suggestedAction,
      reason:
        context.request.language === 'pt'
          ? 'A decisão final deve ser humana. Use esta triagem para priorizar investigação e validar impacto operacional.'
          : 'Final action must be human-approved. Use this triage to prioritize investigation and validate operational impact.',
    },
    evidence: [
      {
        label: context.request.language === 'pt' ? 'Mensagem do analista' : 'Analyst prompt',
        detail: safeText(context.request.message, 320),
        relevance: 'medium',
      },
      {
        label: context.request.language === 'pt' ? 'Contexto disponível' : 'Available context',
        detail: [context.threat ? 'threat' : '', context.threatEvent ? 'threat_event' : '', context.alert ? 'alert' : '']
          .filter(Boolean)
          .join(', ') || (context.request.language === 'pt' ? 'somente histórico recente' : 'recent history only'),
        relevance: 'medium',
      },
    ],
    nextSteps:
      context.request.language === 'pt'
        ? [
            'Validar IOC principal com logs brutos e normalizados.',
            'Correlacionar com eventos recentes do mesmo vetor.',
            'Registrar decisão humana com justificativa no fluxo de incidentes.',
          ]
        : [
            'Validate primary IOC against raw and normalized logs.',
            'Correlate with recent events from the same vector.',
            'Record a human decision with justification in incident workflow.',
          ],
    constraints:
      context.request.language === 'pt'
        ? [
            'A IA não executa bloqueio ou liberação automaticamente.',
            'Decisão final deve ser tomada por operador autenticado.',
          ]
        : [
            'AI does not execute block/allow actions automatically.',
            'Final action must be taken by an authenticated operator.',
          ],
    poweredByAi: false,
  };
}

function extractJsonObject(text: string): unknown {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('No JSON object found in AI response');
  }
  const candidate = text.slice(firstBrace, lastBrace + 1);
  return JSON.parse(candidate);
}

export async function generateAiThreatAssessment(params: {
  client: OpenAI | null;
  model: string;
  context: ThreatContext;
}): Promise<AiThreatAssessment> {
  const fallback = buildFallbackAssessment(params.context);

  if (!params.client) {
    return fallback;
  }

  const payload = {
    analystRequest: {
      message: safeText(params.context.request.message, 1200),
      language: params.context.request.language,
    },
    focusedRecords: {
      threat: params.context.threat ? compactThreat(params.context.threat) : null,
      threatEvent: params.context.threatEvent ? compactThreatEvent(params.context.threatEvent) : null,
      alert: params.context.alert ? compactAlert(params.context.alert) : null,
    },
    recent: {
      threats: params.context.recentThreats.slice(0, 5).map(compactThreat),
      threatEvents: params.context.recentThreatEvents.slice(0, 5).map(compactThreatEvent),
      alerts: params.context.recentAlerts.slice(0, 5).map(compactAlert),
    },
  };

  const response = await params.client.responses.create({
    model: params.model,
    input: [
      {
        role: 'system',
        content:
          params.context.request.language === 'pt'
            ? 'Você é um analista SOC assistivo. Forneça apenas JSON válido. Nunca execute ações. Nunca recomende automação de bloqueio/liberação. Sempre defina recommendation.status como awaiting_human_decision.'
            : 'You are an assistive SOC analyst. Return valid JSON only. Never execute actions. Never recommend automatic block/allow enforcement. Always set recommendation.status to awaiting_human_decision.',
      },
      {
        role: 'user',
        content: `Assess this security context and respond with one JSON object matching this exact shape: {"summary":string,"riskLevel":"low|medium|high|critical","confidence":number,"recommendation":{"status":"awaiting_human_decision","suggestedAction":"block|allow|monitor|investigate","reason":string},"evidence":[{"label":string,"detail":string,"relevance":"low|medium|high"}],"nextSteps":[string],"constraints":[string]}. Context: ${JSON.stringify(payload)}`,
      },
    ],
  });

  const output = response.output_text?.trim();
  if (!output) {
    return fallback;
  }

  const parsedObject = extractJsonObject(output);
  if (!parsedObject || typeof parsedObject !== 'object' || Array.isArray(parsedObject)) {
    return fallback;
  }
  const parsed = aiThreatAssessmentSchema.safeParse({
    ...parsedObject,
    poweredByAi: true,
  });

  if (!parsed.success) {
    return fallback;
  }

  return parsed.data;
}