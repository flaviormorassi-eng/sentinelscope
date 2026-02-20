import React from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { HelpCircle, ChevronLeft, ChevronRight, X, ExternalLink, ShieldAlert, RotateCcw, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest } from '@/lib/queryClient';

type Tip = {
  titleKey: string;
  titleDefault: string;
  descriptionKey: string;
  descriptionDefault: string;
  actionLabelKey?: string;
  actionLabelDefault?: string;
  actionHref?: string;
};

const defaultTips: Tip[] = [
  {
    titleKey: 'interactiveHelper.default.sidebar.title',
    titleDefault: 'Use the sidebar as your control center',
    descriptionKey: 'interactiveHelper.default.sidebar.description',
    descriptionDefault: 'Navigate between Dashboard, Security Center, Network Activity, Reports, and Settings from the left menu.',
  },
  {
    titleKey: 'interactiveHelper.default.triage.title',
    titleDefault: 'Follow the triage flow',
    descriptionKey: 'interactiveHelper.default.triage.description',
    descriptionDefault: 'Start with Alerts or Threat Log, investigate on Threat Map, then pivot to Network Flow for full context.',
    actionLabelKey: 'interactiveHelper.actions.openSecurityCenter',
    actionLabelDefault: 'Open Security Center',
    actionHref: '/security-center',
  },
  {
    titleKey: 'interactiveHelper.default.search.title',
    titleDefault: 'Use Global Search',
    descriptionKey: 'interactiveHelper.default.search.description',
    descriptionDefault: 'Use the top search to jump quickly across data and reduce investigation time.',
  },
];

const routeTips: Array<{ match: RegExp; tips: Tip[] }> = [
  {
    match: /^\/dashboard/,
    tips: [
      {
        titleKey: 'interactiveHelper.dashboard.kpi.title',
        titleDefault: 'Start with KPIs',
        descriptionKey: 'interactiveHelper.dashboard.kpi.description',
        descriptionDefault: 'Watch Active Threats, Blocked threats, and Alerts to understand current risk posture.',
      },
      {
        titleKey: 'interactiveHelper.dashboard.trends.title',
        titleDefault: 'Drill down from trends',
        descriptionKey: 'interactiveHelper.dashboard.trends.description',
        descriptionDefault: 'Use timeline and threat-type charts to identify spikes, then open Security Center for details.',
        actionLabelKey: 'interactiveHelper.actions.openSecurityCenter',
        actionLabelDefault: 'Open Security Center',
        actionHref: '/security-center',
      },
    ],
  },
  {
    match: /^\/security-center/,
    tips: [
      {
        titleKey: 'interactiveHelper.securityCenter.tabs.title',
        titleDefault: 'Switch tabs to triage',
        descriptionKey: 'interactiveHelper.securityCenter.tabs.description',
        descriptionDefault: 'Use the Threats and Alerts tabs to assess priority and review event context quickly.',
      },
      {
        titleKey: 'interactiveHelper.securityCenter.actions.title',
        titleDefault: 'Use row quick actions',
        descriptionKey: 'interactiveHelper.securityCenter.actions.description',
        descriptionDefault: 'Open Map, Flow, and related pages directly from selected records to keep context.',
      },
      {
        titleKey: 'interactiveHelper.securityCenter.filters.title',
        titleDefault: 'Clear filters if target is missing',
        descriptionKey: 'interactiveHelper.securityCenter.filters.description',
        descriptionDefault: 'If a focused threat/alert is not found, clear filters and let target-page jump locate it.',
      },
    ],
  },
  {
    match: /^\/network-activity/,
    tips: [
      {
        titleKey: 'interactiveHelper.networkActivity.sources.title',
        titleDefault: 'Review risky sources first',
        descriptionKey: 'interactiveHelper.networkActivity.sources.description',
        descriptionDefault: 'Use suspicious-only and grouped source views to focus on high-risk traffic patterns.',
      },
      {
        titleKey: 'interactiveHelper.networkActivity.pivot.title',
        titleDefault: 'Pivot with context links',
        descriptionKey: 'interactiveHelper.networkActivity.pivot.description',
        descriptionDefault: 'Jump to Threat Log, Alerts, and Map while preserving selected source/threat context.',
      },
    ],
  },
  {
    match: /^\/map/,
    tips: [
      {
        titleKey: 'interactiveHelper.map.context.title',
        titleDefault: 'Use focused map context',
        descriptionKey: 'interactiveHelper.map.context.description',
        descriptionDefault: 'When arriving from Alerts/Threats/Flow, use return actions to continue the same investigation path.',
      },
      {
        titleKey: 'interactiveHelper.map.popup.title',
        titleDefault: 'Open related records from popup',
        descriptionKey: 'interactiveHelper.map.popup.description',
        descriptionDefault: 'Use marker popup actions to inspect the same source in Threat Log or Alerts.',
      },
    ],
  },
  {
    match: /^\/event-sources/,
    tips: [
      {
        titleKey: 'interactiveHelper.eventSources.create.title',
        titleDefault: 'Create and verify ingestion sources',
        descriptionKey: 'interactiveHelper.eventSources.create.description',
        descriptionDefault: 'Use Event Sources to issue API keys and validate data flow from agent/extension.',
      },
      {
        titleKey: 'interactiveHelper.eventSources.rotate.title',
        titleDefault: 'Rotate keys safely',
        descriptionKey: 'interactiveHelper.eventSources.rotate.description',
        descriptionDefault: 'Use key rotation with grace windows to avoid ingestion interruption during credential changes.',
      },
    ],
  },
  {
    match: /^\/settings/,
    tips: [
      {
        titleKey: 'interactiveHelper.settings.mfa.title',
        titleDefault: 'Review monitoring and MFA settings',
        descriptionKey: 'interactiveHelper.settings.mfa.description',
        descriptionDefault: 'Keep monitoring mode and MFA configuration aligned with your security policy.',
      },
      {
        titleKey: 'interactiveHelper.settings.data.title',
        titleDefault: 'Use Data Management carefully',
        descriptionKey: 'interactiveHelper.settings.data.description',
        descriptionDefault: 'Export history before purge actions to preserve audit traceability when needed.',
      },
    ],
  },
];

function resolveTips(pathname: string): Tip[] {
  const entry = routeTips.find((item) => item.match.test(pathname));
  return entry?.tips || defaultTips;
}

type ThreatIndicator = {
  id: string;
  label: string;
  description: string;
  weight: number;
};

type AssistantReply = {
  answer: string;
  commands?: Array<{ command: string; purpose: string; safe: boolean }>;
  safetyChecklist?: string[];
  poweredByAi?: boolean;
};

const beginnerIndicators: ThreatIndicator[] = [
  {
    id: 'unknown_source',
    label: 'Unknown source IP or domain',
    description: 'Traffic origin is new, rare, or not part of expected infrastructure.',
    weight: 20,
  },
  {
    id: 'high_severity',
    label: 'High/Critical severity event',
    description: 'Event severity is high or critical in alerts/threat logs.',
    weight: 25,
  },
  {
    id: 'suspicious_pattern',
    label: 'Suspicious pattern in message',
    description: 'Indicators like SQL injection, XSS, command injection, scanning behavior.',
    weight: 25,
  },
  {
    id: 'repeated_activity',
    label: 'Repeated activity in short time',
    description: 'Multiple similar events from same source over a short period (possible brute-force/scan).',
    weight: 15,
  },
  {
    id: 'cross_page_confirmation',
    label: 'Confirmed across multiple views',
    description: 'Evidence appears in Alerts + Threat Log + Map/Flow context.',
    weight: 15,
  },
];

const beginnerQuiz = {
  question:
    'A source IP appears in Alerts with high severity, the same source is visible on Threat Map, and Flow shows repeated failed logins. What is the best first action?',
  options: [
    { id: 'ignore', correct: false },
    { id: 'triage', correct: true },
    { id: 'delete', correct: false },
  ],
  success:
    'Correct. Correlated evidence across views usually indicates a real threat that should be triaged immediately.',
  fail:
    'Not ideal. For beginner triage, prioritize correlated high-severity signals and investigate immediately.',
};

function classifyScore(score: number): { label: string; tone: 'low' | 'medium' | 'high' } {
  if (score >= 70) return { label: 'High risk', tone: 'high' };
  if (score >= 40) return { label: 'Medium risk', tone: 'medium' };
  return { label: 'Low risk', tone: 'low' };
}

export function InteractiveHelper({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const [location, setLocation] = useLocation();
  const { t, i18n } = useTranslation();
  const tips = React.useMemo(() => resolveTips(location), [location]);
  const [mode, setMode] = React.useState<'guide' | 'beginner' | 'ai'>('guide');
  const [step, setStep] = React.useState(0);
  const [selectedIndicators, setSelectedIndicators] = React.useState<string[]>([]);
  const [quizAnswer, setQuizAnswer] = React.useState<string | null>(null);
  const [assistantPrompt, setAssistantPrompt] = React.useState('');
  const [assistantLoading, setAssistantLoading] = React.useState(false);
  const [assistantReply, setAssistantReply] = React.useState<AssistantReply | null>(null);

  React.useEffect(() => {
    setStep(0);
  }, [location]);

  const score = beginnerIndicators
    .filter((i) => selectedIndicators.includes(i.id))
    .reduce((acc, i) => acc + i.weight, 0);

  if (!open) return null;

  const current = tips[Math.min(step, tips.length - 1)] || tips[0];
  const canPrev = step > 0;
  const canNext = step < tips.length - 1;
  const scoreInfo = classifyScore(score);
  const selectedQuiz = beginnerQuiz.options.find((o) => o.id === quizAnswer);

  const toggleIndicator = (id: string) => {
    setSelectedIndicators((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const resetBeginner = () => {
    setSelectedIndicators([]);
    setQuizAnswer(null);
  };

  const askAssistant = async (prompt?: string) => {
    const question = (prompt ?? assistantPrompt).trim();
    if (!question) return;
    setAssistantLoading(true);
    try {
      const language: 'en' | 'pt' = i18n.language?.startsWith('pt') ? 'pt' : 'en';
      const reply = await apiRequest('POST', '/api/helper/assistant', { question, language });
      setAssistantReply(reply);
    } catch (err: any) {
      const rawMessage = String(err?.message || '');
      const endpointMissing = /404/.test(rawMessage) || /not found/i.test(rawMessage);
      setAssistantReply({
        answer: endpointMissing
          ? t('interactiveHelper.ai.errorMissingEndpoint', {
              defaultValue:
                'AI Coach endpoint is not available on the running server yet. Restart the app server (npm run dev:restart) and try again.',
            })
          : rawMessage || t('interactiveHelper.ai.error', { defaultValue: 'Assistant request failed.' }),
        poweredByAi: false,
      });
    } finally {
      setAssistantLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[420px] max-w-[calc(100vw-2rem)]">
      <Card className="shadow-xl border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary" />
                {t('interactiveHelper.title', { defaultValue: 'Interactive Helper' })}
              </CardTitle>
              <CardDescription>
                {mode === 'guide'
                  ? t('interactiveHelper.step', { current: step + 1, total: tips.length, defaultValue: 'Step {{current}} of {{total}}' })
                  : t('interactiveHelper.beginnerSubtitle', { defaultValue: 'Beginner training: learn how to identify threats' })}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenChange(false)}
              aria-label={t('interactiveHelper.closeAria', { defaultValue: 'Close helper' })}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={mode === 'guide' ? 'secondary' : 'outline'}
              className="h-auto py-1.5 whitespace-normal text-left"
              onClick={() => setMode('guide')}
            >
              {t('interactiveHelper.modeGuide', { defaultValue: 'Quick Guide' })}
            </Button>
            <Button
              size="sm"
              variant={mode === 'beginner' ? 'secondary' : 'outline'}
              className="h-auto py-1.5 whitespace-normal text-left"
              onClick={() => setMode('beginner')}
            >
              {t('interactiveHelper.modeBeginner', { defaultValue: 'Beginner Mode' })}
            </Button>
            <Button
              size="sm"
              variant={mode === 'ai' ? 'secondary' : 'outline'}
              className="h-auto py-1.5 whitespace-normal text-left"
              onClick={() => setMode('ai')}
            >
              {t('interactiveHelper.modeAi', { defaultValue: 'AI Coach' })}
            </Button>
          </div>

          {mode === 'guide' ? (
            <>
              <div className="space-y-1">
                <p className="font-medium text-sm">{t(current.titleKey, { defaultValue: current.titleDefault })}</p>
                <p className="text-sm text-muted-foreground">{t(current.descriptionKey, { defaultValue: current.descriptionDefault })}</p>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canPrev}
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    {t('interactiveHelper.prev', { defaultValue: 'Prev' })}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canNext}
                    onClick={() => setStep((s) => Math.min(tips.length - 1, s + 1))}
                  >
                    {t('interactiveHelper.next', { defaultValue: 'Next' })}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>

                {current.actionHref && (
                  <Button
                    size="sm"
                    onClick={() => setLocation(current.actionHref!)}
                  >
                    {current.actionLabelKey
                      ? t(current.actionLabelKey, { defaultValue: current.actionLabelDefault || 'Open' })
                      : t('interactiveHelper.open', { defaultValue: 'Open' })}
                    <ExternalLink className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </>
          ) : mode === 'beginner' ? (
            <>
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                  {t('interactiveHelper.beginnerHowToTitle', { defaultValue: 'How to identify a threat (beginner checklist)' })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('interactiveHelper.beginnerHowToDescription', { defaultValue: 'Select the signals you observe. The helper estimates risk so you can decide triage priority.' })}
                </p>
              </div>

              <div className="space-y-2">
                {beginnerIndicators.map((indicator) => {
                  const active = selectedIndicators.includes(indicator.id);
                  return (
                    <Button
                      key={indicator.id}
                      type="button"
                      variant={active ? 'secondary' : 'outline'}
                      className="w-full h-auto justify-start items-start text-left py-2 whitespace-normal"
                      onClick={() => toggleIndicator(indicator.id)}
                    >
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">{t(`interactiveHelper.beginnerSignals.${indicator.id}.label`, { defaultValue: indicator.label })}</span>
                        <span className="text-xs text-muted-foreground">{t(`interactiveHelper.beginnerSignals.${indicator.id}.description`, { defaultValue: indicator.description })}</span>
                      </div>
                    </Button>
                  );
                })}
              </div>

              <div className="rounded-md border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">{t('interactiveHelper.riskScore', { defaultValue: 'Estimated risk score' })}</p>
                <p className="font-semibold text-sm">{score}/100 • {t(`interactiveHelper.risk.${scoreInfo.tone}`, { defaultValue: scoreInfo.label })}</p>
              </div>

              <div className="rounded-md border p-3 space-y-2">
                <p className="text-sm font-medium">{t('interactiveHelper.quizTitle', { defaultValue: 'Mini scenario' })}</p>
                <p className="text-xs text-muted-foreground">{t('interactiveHelper.quizQuestion', { defaultValue: beginnerQuiz.question })}</p>
                <div className="space-y-2">
                  {beginnerQuiz.options.map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      variant={quizAnswer === option.id ? 'secondary' : 'outline'}
                      className="w-full h-auto py-2 justify-start items-start text-left whitespace-normal"
                      onClick={() => setQuizAnswer(option.id)}
                    >
                      {t(`interactiveHelper.quizOptions.${option.id}`, {
                        defaultValue:
                          option.id === 'ignore'
                            ? 'Ignore it until more data arrives'
                            : option.id === 'triage'
                              ? 'Start triage immediately and pivot across Threat Log, Map, and Flow'
                              : 'Delete all alerts to reduce noise',
                      })}
                    </Button>
                  ))}
                </div>
                {selectedQuiz && (
                  <p className={`text-xs ${selectedQuiz.correct ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {selectedQuiz.correct
                      ? t('interactiveHelper.quizSuccess', { defaultValue: beginnerQuiz.success })
                      : t('interactiveHelper.quizFail', { defaultValue: beginnerQuiz.fail })}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <Button size="sm" variant="outline" onClick={resetBeginner}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  {t('interactiveHelper.resetLesson', { defaultValue: 'Reset lesson' })}
                </Button>

                <Button size="sm" onClick={() => setLocation('/security-center')}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  {t('interactiveHelper.practiceNow', { defaultValue: 'Practice in Security Center' })}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-sm font-medium">{t('interactiveHelper.ai.title', { defaultValue: 'AI API & Terminal Coach' })}</p>
                <p className="text-xs text-muted-foreground">{t('interactiveHelper.ai.description', { defaultValue: 'Ask how to implement API endpoints and run the project safely from terminal.' })}</p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <Button type="button" size="sm" variant="outline" className="h-auto py-2 whitespace-normal text-left justify-start" onClick={() => { const q = t('interactiveHelper.ai.quick.api', { defaultValue: 'How do I add a secure API endpoint in this project?' }); setAssistantPrompt(q); void askAssistant(q); }}>
                  {t('interactiveHelper.ai.quick.api', { defaultValue: 'How do I add a secure API endpoint in this project?' })}
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-auto py-2 whitespace-normal text-left justify-start" onClick={() => { const q = t('interactiveHelper.ai.quick.terminal', { defaultValue: 'Which terminal commands should I run to validate and launch safely?' }); setAssistantPrompt(q); void askAssistant(q); }}>
                  {t('interactiveHelper.ai.quick.terminal', { defaultValue: 'Which terminal commands should I run to validate and launch safely?' })}
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-auto py-2 whitespace-normal text-left justify-start" onClick={() => { const q = t('interactiveHelper.ai.quick.prod', { defaultValue: 'How can I run this project safely before production release?' }); setAssistantPrompt(q); void askAssistant(q); }}>
                  {t('interactiveHelper.ai.quick.prod', { defaultValue: 'How can I run this project safely before production release?' })}
                </Button>
              </div>

              <div className="space-y-2">
                <Textarea
                  value={assistantPrompt}
                  onChange={(e) => setAssistantPrompt(e.target.value)}
                  placeholder={t('interactiveHelper.ai.placeholder', { defaultValue: 'Ask about API implementation, terminal commands, or safe run steps...' })}
                  className="min-h-[90px]"
                />
                <Button size="sm" className="w-full" disabled={assistantLoading || assistantPrompt.trim().length < 3} onClick={() => void askAssistant()}>
                  {assistantLoading
                    ? t('interactiveHelper.ai.loading', { defaultValue: 'Thinking...' })
                    : t('interactiveHelper.ai.ask', { defaultValue: 'Ask AI Coach' })}
                </Button>
              </div>

              {assistantReply && (
                <div className="rounded-md border p-3 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {assistantReply.poweredByAi
                      ? t('interactiveHelper.ai.powered', { defaultValue: 'AI-generated guidance' })
                      : t('interactiveHelper.ai.fallback', { defaultValue: 'Project-safe guidance' })}
                  </p>
                  <p className="text-sm whitespace-pre-line">{assistantReply.answer}</p>

                  {Array.isArray(assistantReply.commands) && assistantReply.commands.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium">{t('interactiveHelper.ai.commands', { defaultValue: 'Suggested commands' })}</p>
                      <ul className="space-y-1">
                        {assistantReply.commands.map((item, idx) => (
                          <li key={`${item.command}-${idx}`} className="text-xs rounded border px-2 py-1">
                            <span className="font-mono">{item.command}</span>
                            <span className="text-muted-foreground"> — {item.purpose}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(assistantReply.safetyChecklist) && assistantReply.safetyChecklist.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium">{t('interactiveHelper.ai.safety', { defaultValue: 'Safety checklist' })}</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {assistantReply.safetyChecklist.map((item, idx) => (
                          <li key={`${item}-${idx}`} className="text-xs">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
