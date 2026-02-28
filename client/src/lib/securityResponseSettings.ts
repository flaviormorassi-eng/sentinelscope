export type SecurityResponseSettings = {
  alertToneEnabled: boolean;
  manualDecisionEnabled: boolean;
  autoBlockEnabled: boolean;
};

const STORAGE_KEY = 'sentinelscope.security.response.settings';

const DEFAULT_SETTINGS: SecurityResponseSettings = {
  alertToneEnabled: true,
  manualDecisionEnabled: true,
  autoBlockEnabled: false,
};

export function getSecurityResponseSettings(): SecurityResponseSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SecurityResponseSettings>;
    return {
      alertToneEnabled: parsed.alertToneEnabled ?? DEFAULT_SETTINGS.alertToneEnabled,
      manualDecisionEnabled: parsed.manualDecisionEnabled ?? DEFAULT_SETTINGS.manualDecisionEnabled,
      autoBlockEnabled: parsed.autoBlockEnabled ?? DEFAULT_SETTINGS.autoBlockEnabled,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function setSecurityResponseSettings(next: Partial<SecurityResponseSettings>) {
  const merged = { ...getSecurityResponseSettings(), ...next };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('security-response-settings-updated', { detail: merged }));
  }
}
