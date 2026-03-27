import OpenAI from 'openai';
import { z } from 'zod';
import type { Alert, Threat, ThreatEvent } from '@shared/schema';

export const SENSITIVE_AI_ADVISORY_NOTICE =
  'This recommendation is advisory only and requires user approval before any enforcement action is taken.';

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
  mitreContext: z.object({
    tactics: z.array(z.string().min(1).max(120)).max(5),
    techniques: z.array(z.string().min(1).max(120)).max(6),
    confidence: z.number().int().min(0).max(100),
  }),
  assetImpact: z.object({
    priority: z.enum(['p1', 'p2', 'p3', 'p4']),
    score: z.number().int().min(0).max(100),
    rationale: z.string().min(1).max(500),
  }),
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

type Signal = {
  key: string;
  labelEn: string;
  labelPt: string;
  weight: number;
  tactics: string[];
  techniques: string[];
};

type MitreRule = {
  pattern: RegExp;
  tactics: string[];
  techniques: string[];
};

const SIGNALS: Signal[] = [
  {
    key: 'phishing',
    labelEn: 'Phishing indicators',
    labelPt: 'Indicadores de phishing',
    weight: 14,
    tactics: ['Initial Access'],
    techniques: ['T1566'],
  },
  {
    key: 'malware',
    labelEn: 'Malware indicators',
    labelPt: 'Indicadores de malware',
    weight: 16,
    tactics: ['Execution', 'Persistence'],
    techniques: ['T1059', 'T1547'],
  },
  {
    key: 'ransomware',
    labelEn: 'Ransomware indicators',
    labelPt: 'Indicadores de ransomware',
    weight: 18,
    tactics: ['Impact'],
    techniques: ['T1486'],
  },
  {
    key: 'sql injection',
    labelEn: 'SQL injection indicators',
    labelPt: 'Indicadores de SQL injection',
    weight: 15,
    tactics: ['Initial Access', 'Credential Access'],
    techniques: ['T1190', 'T1110'],
  },
  {
    key: 'xss',
    labelEn: 'XSS indicators',
    labelPt: 'Indicadores de XSS',
    weight: 13,
    tactics: ['Initial Access'],
    techniques: ['T1189'],
  },
  {
    key: 'command injection',
    labelEn: 'Command injection indicators',
    labelPt: 'Indicadores de command injection',
    weight: 16,
    tactics: ['Execution'],
    techniques: ['T1059'],
  },
  {
    key: 'brute force',
    labelEn: 'Brute-force pattern',
    labelPt: 'Padrão de brute-force',
    weight: 12,
    tactics: ['Credential Access'],
    techniques: ['T1110'],
  },
  {
    key: 'suspicious',
    labelEn: 'Suspicious behavior',
    labelPt: 'Comportamento suspeito',
    weight: 8,
    tactics: ['Discovery'],
    techniques: ['T1083'],
  },
  {
    key: 'scanner',
    labelEn: 'Recon/scanner behavior',
    labelPt: 'Comportamento de scanner/recon',
    weight: 11,
    tactics: ['Reconnaissance'],
    techniques: ['T1595'],
  },
  {
    key: 'c2',
    labelEn: 'Potential C2 communication',
    labelPt: 'Potencial comunicação C2',
    weight: 18,
    tactics: ['Command and Control'],
    techniques: ['T1071'],
  },
];

const MITRE_TYPE_RULES: MitreRule[] = [
  { pattern: /phishing/i, tactics: ['Initial Access'], techniques: ['T1566'] },
  { pattern: /brute[\s-]?force|credential stuffing/i, tactics: ['Credential Access'], techniques: ['T1110'] },
  { pattern: /scanner|recon|port scan/i, tactics: ['Reconnaissance'], techniques: ['T1595'] },
  { pattern: /dns|nxdomain|dnstunnel|dns tunnel/i, tactics: ['Command and Control'], techniques: ['T1071.004'] },
  { pattern: /sql\s*injection|sqli/i, tactics: ['Initial Access'], techniques: ['T1190'] },
  { pattern: /xss|cross[-\s]?site scripting/i, tactics: ['Initial Access'], techniques: ['T1189'] },
  { pattern: /command\s*injection|rce|remote code execution/i, tactics: ['Execution'], techniques: ['T1059'] },
  { pattern: /malware|trojan|loader/i, tactics: ['Execution', 'Persistence'], techniques: ['T1059', 'T1547'] },
  { pattern: /ransomware|encrypt/i, tactics: ['Impact'], techniques: ['T1486'] },
  { pattern: /c2|command and control|beacon/i, tactics: ['Command and Control'], techniques: ['T1071'] },
  { pattern: /data exfil|exfiltration/i, tactics: ['Exfiltration'], techniques: ['T1041'] },
  { pattern: /lateral movement|pass the hash|remote service/i, tactics: ['Lateral Movement'], techniques: ['T1021'] },
  { pattern: /privilege escalation|sudo|uac bypass/i, tactics: ['Privilege Escalation'], techniques: ['T1068'] },
  { pattern: /persistence|startup|registry run/i, tactics: ['Persistence'], techniques: ['T1547'] },
];

const HIGH_VALUE_ASSET_TERMS = [
  'domain controller',
  'dc',
  'payment',
  'billing',
  'database',
  'prod',
  'production',
  'customer',
  'pii',
  'admin portal',
  'auth',
  'identity',
  'vpn',
  'critical asset',
];

const EXTERNAL_EXPOSURE_TERMS = ['internet', 'public', 'external', 'ingress', 'edge', 'dmz'];
const PRIVILEGED_TERMS = ['admin', 'root', 'privileged', 'service account', 'sudo'];

function isPrivateIp(value: string): boolean {
  const ip = safeText(value, 64);
  if (!ip) return false;
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  if (/^127\./.test(ip)) return true;
  return false;
}

function extractAssetLabels(text: string): string[] {
  const labels = new Set<string>();
  const normalized = safeText(text, 3000);
  const regex = /(?:asset|host|service|system|criticality|tier)\s*[:=]\s*([a-zA-Z0-9._\/-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(normalized)) !== null) {
    const value = safeText(match[1], 80);
    if (value) labels.add(value);
  }
  return Array.from(labels).slice(0, 4);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function severityToScore(severity: string): number {
  const normalized = safeText(severity, 24).toLowerCase();
  if (normalized === 'critical') return 35;
  if (normalized === 'high') return 24;
  if (normalized === 'medium') return 14;
  if (normalized === 'low') return 6;
  return 0;
}

function scoreToRiskLevel(score: number): AiThreatAssessment['riskLevel'] {
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function detectSignals(text: string): Array<{ signal: Signal; hits: number }> {
  const normalized = safeText(text, 8000).toLowerCase();
  return SIGNALS.map((signal) => {
    const regex = new RegExp(signal.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const hits = (normalized.match(regex) || []).length;
    return { signal, hits };
  }).filter((entry) => entry.hits > 0);
}

function getMitreContext(
  detectedSignals: Array<{ signal: Signal; hits: number }>,
  riskLevel: AiThreatAssessment['riskLevel'],
  context: ThreatContext,
): AiThreatAssessment['mitreContext'] {
  const tactics = new Set<string>();
  const techniques = new Set<string>();

  for (const entry of detectedSignals) {
    for (const tactic of entry.signal.tactics) tactics.add(tactic);
    for (const technique of entry.signal.techniques) techniques.add(technique);
  }

  const typeAndVectorCorpus = [
    context.threat?.type,
    context.threat?.description,
    context.threat?.threatVector,
    context.threatEvent?.threatType,
    context.threatEvent?.threatVector,
    context.alert?.title,
    context.alert?.message,
    context.request.message,
  ]
    .filter(Boolean)
    .join(' ');

  for (const rule of MITRE_TYPE_RULES) {
    if (rule.pattern.test(typeAndVectorCorpus)) {
      for (const tactic of rule.tactics) tactics.add(tactic);
      for (const technique of rule.techniques) techniques.add(technique);
    }
  }

  if (tactics.size === 0) {
    tactics.add('Discovery');
    techniques.add('T1083');
  }

  const baseConfidence =
    40 +
    Math.min(30, detectedSignals.length * 7) +
    Math.min(18, Math.max(0, tactics.size - 1) * 4) +
    (riskLevel === 'critical' ? 10 : riskLevel === 'high' ? 6 : 0);

  return {
    tactics: Array.from(tactics).slice(0, 5),
    techniques: Array.from(techniques).slice(0, 6),
    confidence: clamp(baseConfidence, 30, 95),
  };
}

function assessAssetImpact(
  context: ThreatContext,
  riskLevel: AiThreatAssessment['riskLevel'],
): AiThreatAssessment['assetImpact'] {
  const sourceIp = safeText(context.threat?.sourceIP, 64);
  const targetIp = safeText(context.threat?.targetIP, 64);
  const sourceUrl = safeText(context.threat?.sourceURL || context.threatEvent?.sourceURL, 240);
  const deviceName = safeText(context.threat?.deviceName || context.threatEvent?.deviceName, 120);
  const threatVector = safeText(context.threat?.threatVector || context.threatEvent?.threatVector, 140);

  const corpus = [
    context.request.message,
    context.threat?.description,
    context.threat?.type,
    sourceUrl,
    threatVector,
    deviceName,
    context.threatEvent?.threatType,
    context.alert?.title,
    context.alert?.message,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const highValueHits = HIGH_VALUE_ASSET_TERMS.filter((term) => corpus.includes(term)).length;
  const exposureHits = EXTERNAL_EXPOSURE_TERMS.filter((term) => corpus.includes(term)).length;
  const privilegedHits = PRIVILEGED_TERMS.filter((term) => corpus.includes(term)).length;
  const sourceExternalTargetInternal = !!sourceIp && !!targetIp && !isPrivateIp(sourceIp) && isPrivateIp(targetIp);
  const publicUrl = /^https?:\/\//i.test(sourceUrl);
  const parsedAssetLabels = extractAssetLabels(
    [context.request.message, context.threat?.description, context.alert?.message, context.alert?.title].filter(Boolean).join(' '),
  );
  const assetLabelBoost = parsedAssetLabels.length > 0 ? Math.min(12, parsedAssetLabels.length * 4) : 0;

  const baseByRisk = riskLevel === 'critical' ? 62 : riskLevel === 'high' ? 46 : riskLevel === 'medium' ? 30 : 16;
  const focusedBoost = context.threat || context.threatEvent || context.alert ? 10 : 0;
  const score = clamp(
    baseByRisk +
      highValueHits * 8 +
      exposureHits * 5 +
      privilegedHits * 7 +
      (sourceExternalTargetInternal ? 9 : 0) +
      (publicUrl ? 5 : 0) +
      assetLabelBoost +
      focusedBoost,
    8,
    99,
  );

  const priority: AiThreatAssessment['assetImpact']['priority'] =
    score >= 80 ? 'p1' : score >= 62 ? 'p2' : score >= 40 ? 'p3' : 'p4';

  const rationale =
    context.request.language === 'pt'
      ? `Priorização ${priority.toUpperCase()} por score ${score}/100 (ativo crítico=${highValueHits}, exposição externa=${exposureHits}, contexto privilegiado=${privilegedHits}, rota externa→interna=${sourceExternalTargetInternal ? 'sim' : 'não'}, ativos identificados=${parsedAssetLabels.join(', ') || 'n/a'}).`
      : `Priority ${priority.toUpperCase()} from score ${score}/100 (critical-asset hits=${highValueHits}, external exposure=${exposureHits}, privileged-context hits=${privilegedHits}, external-to-internal path=${sourceExternalTargetInternal ? 'yes' : 'no'}, identified assets=${parsedAssetLabels.join(', ') || 'n/a'}).`;

  return {
    priority,
    score,
    rationale,
  };
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = safeText(value, 160);
    if (text) return text;
  }
  return '';
}

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
  const language = context.request.language;
  const focusedSeverity =
    firstNonEmpty(context.threat?.severity, context.threatEvent?.severity, context.alert?.severity) || 'unknown';
  const focusedType = firstNonEmpty(context.threat?.type, context.threatEvent?.threatType, context.alert?.title) || 'unknown';
  const focusedStatus = firstNonEmpty(context.threat?.status, context.threatEvent?.mitigationStatus, context.alert?.read ? 'read' : 'unread') || 'unknown';
  const focusedEntityCount = [context.threat, context.threatEvent, context.alert].filter(Boolean).length;

  const severityPressureScore = [
    severityToScore(context.threat?.severity || ''),
    severityToScore(context.threatEvent?.severity || ''),
    severityToScore(context.alert?.severity || ''),
    ...context.recentThreats.map((item) => severityToScore(item.severity || '')),
    ...context.recentThreatEvents.map((item) => severityToScore(item.severity || '')),
    ...context.recentAlerts.map((item) => severityToScore(item.severity || '')),
  ].reduce((acc, current) => acc + current, 0);

  const promptAndContextText = [
    context.request.message,
    context.threat?.type,
    context.threat?.description,
    context.threatEvent?.threatType,
    context.alert?.title,
    context.alert?.message,
    ...context.recentThreats.map((item) => `${item.type} ${item.description}`),
    ...context.recentThreatEvents.map((item) => item.threatType),
    ...context.recentAlerts.map((item) => `${item.title} ${item.message}`),
  ]
    .filter(Boolean)
    .join(' ');

  const detectedSignals = detectSignals(promptAndContextText);
  const signalScore = detectedSignals.reduce((acc, entry) => acc + entry.signal.weight * Math.min(2, entry.hits), 0);

  const repeatedThreatTypeCount =
    context.threatEvent?.threatType
      ? context.recentThreatEvents.filter(
          (event) => safeText(event.threatType, 100).toLowerCase() === safeText(context.threatEvent?.threatType, 100).toLowerCase(),
        ).length
      : context.threat?.type
      ? context.recentThreats.filter(
          (item) => safeText(item.type, 100).toLowerCase() === safeText(context.threat?.type, 100).toLowerCase(),
        ).length
      : 0;

  const recurrenceScore = repeatedThreatTypeCount >= 3 ? 16 : repeatedThreatTypeCount >= 2 ? 10 : repeatedThreatTypeCount === 1 ? 5 : 0;

  const blockedSignalScore =
    (context.threat?.blocked ? 8 : 0) +
    (context.threatEvent?.autoBlocked ? 8 : 0) +
    (safeText(context.threatEvent?.mitigationStatus, 40).toLowerCase() === 'blocked' ? 6 : 0);

  const contextDepthScore = focusedEntityCount > 0 ? 12 : 0;
  const rawScore = severityPressureScore + signalScore + recurrenceScore + blockedSignalScore + contextDepthScore;
  const score = clamp(rawScore, 5, 98);
  const riskLevel = scoreToRiskLevel(score);
  const mitreContext = getMitreContext(detectedSignals, riskLevel, context);
  const assetImpact = assessAssetImpact(context, riskLevel);

  const suggestedAction: AiThreatAssessment['recommendation']['suggestedAction'] =
    riskLevel === 'critical' ? 'block' : riskLevel === 'high' ? 'investigate' : riskLevel === 'medium' ? 'monitor' : 'allow';

  const confidence = clamp(
    42 + Math.min(24, detectedSignals.length * 5) + (focusedEntityCount > 0 ? 12 : 0) + (repeatedThreatTypeCount > 0 ? 8 : 0),
    35,
    96,
  );

  const summary =
    language === 'pt'
      ? `Análise heurística local: severidade foco=${focusedSeverity}, tipo=${focusedType}, status=${focusedStatus}, score=${score}/100 (${riskLevel}). ${focusedEntityCount > 0 ? 'Contexto específico carregado.' : 'Sem entidade focal; análise baseada em histórico recente.'}`
      : `Local heuristic analysis: focused severity=${focusedSeverity}, type=${focusedType}, status=${focusedStatus}, score=${score}/100 (${riskLevel}). ${focusedEntityCount > 0 ? 'Focused entity context loaded.' : 'No focused entity; analysis based on recent history.'}`;

  const recommendationReason =
    language === 'pt'
      ? `Risco ${riskLevel} com score ${score}/100, ${detectedSignals.length} sinal(is) técnico(s) e recorrência ${repeatedThreatTypeCount}. Requer validação humana antes de qualquer enforcement.`
      : `Risk is ${riskLevel} with score ${score}/100, ${detectedSignals.length} technical signal(s), and recurrence=${repeatedThreatTypeCount}. Human validation is required before any enforcement.`;

  const evidence: AiThreatAssessment['evidence'] = [];

  evidence.push({
    label: language === 'pt' ? 'Prompt do analista' : 'Analyst prompt',
    detail: safeText(context.request.message, 320),
    relevance: 'medium',
  });

  evidence.push({
    label: language === 'pt' ? 'Contexto focal' : 'Focused context',
    detail:
      focusedEntityCount > 0
        ? `${language === 'pt' ? 'tipo' : 'type'}=${focusedType}, ${language === 'pt' ? 'severidade' : 'severity'}=${focusedSeverity}, ${language === 'pt' ? 'status' : 'status'}=${focusedStatus}`
        : language === 'pt'
        ? 'Nenhuma entidade focal enviada (threat/threatEvent/alert).'
        : 'No focused entity provided (threat/threatEvent/alert).',
    relevance: focusedEntityCount > 0 ? 'high' : 'low',
  });

  evidence.push({
    label: language === 'pt' ? 'Pressão de severidade' : 'Severity pressure',
    detail:
      language === 'pt'
        ? `Eventos recentes analisados: threats=${context.recentThreats.length}, threatEvents=${context.recentThreatEvents.length}, alerts=${context.recentAlerts.length}.`
        : `Recent analyzed events: threats=${context.recentThreats.length}, threatEvents=${context.recentThreatEvents.length}, alerts=${context.recentAlerts.length}.`,
    relevance: riskLevel === 'high' || riskLevel === 'critical' ? 'high' : 'medium',
  });

  if (detectedSignals.length > 0) {
    const topSignals = detectedSignals
      .sort((a, b) => b.signal.weight * b.hits - a.signal.weight * a.hits)
      .slice(0, 2)
      .map((entry) =>
        `${language === 'pt' ? entry.signal.labelPt : entry.signal.labelEn} (x${entry.hits})`,
      )
      .join('; ');
    evidence.push({
      label: language === 'pt' ? 'Sinais técnicos' : 'Technical signals',
      detail: topSignals,
      relevance: 'high',
    });
  }

  evidence.push({
    label: language === 'pt' ? 'Mapeamento MITRE' : 'MITRE mapping',
    detail:
      language === 'pt'
        ? `Táticas: ${mitreContext.tactics.join(', ')} | Técnicas: ${mitreContext.techniques.join(', ')}`
        : `Tactics: ${mitreContext.tactics.join(', ')} | Techniques: ${mitreContext.techniques.join(', ')}`,
    relevance: riskLevel === 'critical' || riskLevel === 'high' ? 'high' : 'medium',
  });

  evidence.push({
    label: language === 'pt' ? 'Impacto em ativo' : 'Asset impact',
    detail: assetImpact.rationale,
    relevance: assetImpact.priority === 'p1' || assetImpact.priority === 'p2' ? 'high' : 'medium',
  });

  if (repeatedThreatTypeCount > 0) {
    evidence.push({
      label: language === 'pt' ? 'Recorrência' : 'Recurrence',
      detail:
        language === 'pt'
          ? `Mesmo tipo/vetor observado ${repeatedThreatTypeCount} vez(es) no histórico recente.`
          : `Same type/vector observed ${repeatedThreatTypeCount} time(s) in recent history.`,
      relevance: repeatedThreatTypeCount >= 2 ? 'high' : 'medium',
    });
  }

  const nextSteps =
    language === 'pt'
      ? [
          focusedEntityCount > 0
            ? 'Confirmar IOC da entidade focal em logs normalizados e brutos.'
            : 'Selecionar uma entidade específica (incidente/alerta) para investigação mais precisa.',
          'Correlacionar origem, vetor e recorrência nos últimos eventos.',
          'Mapear táticas/técnicas MITRE ATT&CK para orientar contenção e caça retroativa.',
          'Comparar evidências com baseline esperado do tenant/ambiente.',
          'Registrar decisão humana com justificativa operacional e impacto.',
        ]
      : [
          focusedEntityCount > 0
            ? 'Validate focused-entity IOC in normalized and raw logs.'
            : 'Select a specific incident/alert for more precise investigation.',
          'Correlate origin, vector, and recurrence across recent events.',
          'Map MITRE ATT&CK tactics/techniques to drive containment and retrospective hunting.',
          'Compare evidence against tenant/environment baseline.',
          'Record human decision with operational impact rationale.',
        ];

  return {
    summary,
    riskLevel,
    confidence,
    mitreContext,
    assetImpact,
    recommendation: {
      status: 'awaiting_human_decision',
      suggestedAction,
      reason: recommendationReason,
    },
    evidence: evidence.slice(0, 8),
    nextSteps: nextSteps.slice(0, 6),
    constraints:
      context.request.language === 'pt'
        ? [
            'A IA não executa bloqueio ou liberação automaticamente.',
            'Decisão final deve ser tomada por operador autenticado.',
            SENSITIVE_AI_ADVISORY_NOTICE,
          ]
        : [
            'AI does not execute block/allow actions automatically.',
            'Final action must be taken by an authenticated operator.',
            SENSITIVE_AI_ADVISORY_NOTICE,
          ],
    poweredByAi: false,
  };
}

function withMandatoryAdvisory(assessment: AiThreatAssessment): AiThreatAssessment {
  const current = Array.isArray(assessment.constraints) ? assessment.constraints.filter(Boolean) : [];
  const hasAdvisory = current.some((line) => String(line).trim() === SENSITIVE_AI_ADVISORY_NOTICE);
  if (hasAdvisory) {
    return assessment;
  }

  const nextConstraints = [...current, SENSITIVE_AI_ADVISORY_NOTICE].slice(-6);
  return {
    ...assessment,
    constraints: nextConstraints,
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
  const fallback = withMandatoryAdvisory(buildFallbackAssessment(params.context));

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
        content: `Assess this security context and respond with one JSON object matching this exact shape: {"summary":string,"riskLevel":"low|medium|high|critical","confidence":number,"mitreContext":{"tactics":[string],"techniques":[string],"confidence":number},"assetImpact":{"priority":"p1|p2|p3|p4","score":number,"rationale":string},"recommendation":{"status":"awaiting_human_decision","suggestedAction":"block|allow|monitor|investigate","reason":string},"evidence":[{"label":string,"detail":string,"relevance":"low|medium|high"}],"nextSteps":[string],"constraints":[string]}. Context: ${JSON.stringify(payload)}`,
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

  return withMandatoryAdvisory(parsed.data);
}