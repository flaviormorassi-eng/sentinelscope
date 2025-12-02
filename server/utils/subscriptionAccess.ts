import { storage } from "../storage";

export interface RealMonitoringAccess {
  canAccess: boolean;
  reason: 'paid_subscription' | 'active_trial' | 'no_access';
  trialStatus?: {
    isActive: boolean;
    expiresAt: Date | null;
    hoursRemaining: number | null;
  };
}

// Control override via env: default to ON unless explicitly set to 'false'
const ALWAYS_ON = process.env.REAL_MONITORING_ALWAYS_ON !== 'false';

export async function checkRealMonitoringAccess(
  userId: string
): Promise<RealMonitoringAccess> {
  if (ALWAYS_ON) {
    return {
      canAccess: true,
      reason: 'paid_subscription',
      trialStatus: {
        isActive: true,
        expiresAt: null,
        hoursRemaining: null,
      },
    };
  }

  // Fallback to the original logic when override is disabled
  const user = await storage.getUser(userId);
  if (!user) {
    return {
      canAccess: false,
      reason: 'no_access',
    };
  }

  const isPaidSubscription = user.subscriptionTier === 'smb' || user.subscriptionTier === 'enterprise';
  if (isPaidSubscription) {
    return {
      canAccess: true,
      reason: 'paid_subscription',
    };
  }

  const prefs = await storage.getUserPreferences(userId);
  if (!prefs || !prefs.trialStartedAt || !prefs.trialExpiresAt) {
    return {
      canAccess: false,
      reason: 'no_access',
      trialStatus: {
        isActive: false,
        expiresAt: null,
        hoursRemaining: null,
      },
    };
  }

  const now = new Date();
  const expiresAt = new Date(prefs.trialExpiresAt);
  const isTrialActive = now < expiresAt;

  if (isTrialActive) {
    const hoursRemaining = Math.max(
      0,
      Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60))
    );

    return {
      canAccess: true,
      reason: 'active_trial',
      trialStatus: {
        isActive: true,
        expiresAt,
        hoursRemaining,
      },
    };
  }

  return {
    canAccess: false,
    reason: 'no_access',
    trialStatus: {
      isActive: false,
      expiresAt,
      hoursRemaining: 0,
    },
  };
}

export async function startRealMonitoringTrial(
  userId: string
): Promise<{ trialStartedAt: Date; trialExpiresAt: Date }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

  // Debug: log trial creation
  console.log(`[trial] startRealMonitoringTrial user=${userId} now=${now.toISOString()} expiresAt=${expiresAt.toISOString()}`);

  const prefs = await storage.getUserPreferences(userId);
  await storage.upsertUserPreferences({
    userId,
    emailNotifications: prefs?.emailNotifications ?? true,
    pushNotifications: prefs?.pushNotifications ?? true,
    alertThreshold: prefs?.alertThreshold ?? 'medium',
    // When starting a trial, explicitly enable real monitoring so the UI
    // and API endpoints will immediately reflect that the user is in real mode.
    monitoringMode: 'real',
    trialStartedAt: now,
    trialExpiresAt: expiresAt,
  });

  return {
    trialStartedAt: now,
    trialExpiresAt: expiresAt,
  };
}
