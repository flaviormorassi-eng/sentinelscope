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

export async function checkRealMonitoringAccess(
  userId: string
): Promise<RealMonitoringAccess> {
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

  const prefs = await storage.getUserPreferences(userId);
  await storage.upsertUserPreferences({
    userId,
    emailNotifications: prefs?.emailNotifications ?? true,
    pushNotifications: prefs?.pushNotifications ?? true,
    alertThreshold: prefs?.alertThreshold ?? 'medium',
    monitoringMode: prefs?.monitoringMode ?? 'demo',
    trialStartedAt: now,
    trialExpiresAt: expiresAt,
  });

  return {
    trialStartedAt: now,
    trialExpiresAt: expiresAt,
  };
}
