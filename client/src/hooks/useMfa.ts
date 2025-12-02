import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export interface MfaStatus {
  totpEnabled: boolean;
  phoneEnabled: boolean;
  failedAttempts: number;
  lockedUntil: string | null;
  lastVerifiedAt: string | null;
  hasRecoveryCodes: boolean;
  phonePending?: boolean;
  phoneVerificationExpiresAt?: string | null;
  phoneVerificationAttempts?: number;
  maskedPhone?: string | null;
  webauthnCredsCount?: number;
}

interface EnrollResponse { otpauthUrl: string; qrDataUrl: string; }
interface VerifyResponse { success: boolean; recoveryCodes?: string[]; }
interface RecoveryRegenerateResponse { recoveryCodes: string[]; }

export function useMfaStatus() {
  return useQuery<MfaStatus>({ queryKey: ['/api/mfa/status'] });
}

export function useEnrollTotp() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  return useMutation<EnrollResponse, Error, void>({
    mutationFn: async () => apiRequest('POST', '/api/mfa/enroll-totp'),
    onSuccess: () => {
      toast({ title: t('mfa.toast.enrollStarted.title'), description: t('mfa.toast.enrollStarted.desc') });
    },
    onError: (e) => toast({ title: t('mfa.toast.error.enroll'), description: e.message, variant: 'destructive' })
  });
}

export function useVerifyTotp() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  return useMutation<VerifyResponse, Error, { token: string }>({
    mutationFn: async (vars) => apiRequest('POST', '/api/mfa/verify-totp', { token: vars.token }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['/api/mfa/status'] });
      toast({ title: t('mfa.toast.verifySuccess.title'), description: data.recoveryCodes ? t('mfa.toast.verifySuccess.withCodes') : t('mfa.toast.verifySuccess.noCodes') });
    },
    onError: (e) => toast({ title: t('mfa.toast.error.verify'), description: e.message, variant: 'destructive' })
  });
}

export function useRegenerateRecoveryCodes() {
  const { toast } = useToast();
  const { t } = useTranslation();
  return useMutation<RecoveryRegenerateResponse, Error, { token: string }>({
    mutationFn: async (vars) => apiRequest('POST', '/api/mfa/recovery-codes/regenerate', { token: vars.token }),
    onSuccess: () => toast({ title: t('mfa.toast.regenerated.title'), description: t('mfa.toast.regenerated.desc') }),
    onError: (e) => toast({ title: t('mfa.toast.error.regenerate'), description: e.message, variant: 'destructive' })
  });
}

export function useDisableTotp() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  return useMutation<{ success: boolean }, Error, { token?: string; recoveryCode?: string }>({
    mutationFn: async (vars) => apiRequest('POST', '/api/mfa/disable', vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/mfa/status'] });
      toast({ title: t('mfa.toast.disabled.title'), description: t('mfa.toast.disabled.desc') });
    },
    onError: (e) => toast({ title: t('mfa.toast.error.disable'), description: e.message, variant: 'destructive' })
  });
}

// Phone MFA hooks
interface PhoneRequestResponse { success: boolean; expiresAt: string; }
interface PhoneVerifyResponse { success: boolean; }

export function useRequestPhoneCode() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  return useMutation<PhoneRequestResponse, Error, { phoneNumber: string; token: string }>({
    mutationFn: async (vars) => apiRequest('POST', '/api/mfa/phone/request-code', vars),
    onSuccess: (data) => {
      toast({ title: t('mfa.toast.phone.requestSent.title'), description: t('mfa.toast.phone.requestSent.desc', { time: new Date(data.expiresAt).toLocaleTimeString() }) });
    },
    onError: (e) => toast({ title: t('mfa.toast.error.phoneRequest'), description: e.message, variant: 'destructive' })
  });
}

export function useVerifyPhoneCode() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  return useMutation<PhoneVerifyResponse, Error, { code: string }>({
    mutationFn: async (vars) => apiRequest('POST', '/api/mfa/phone/verify-code', vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/mfa/status'] });
      toast({ title: t('mfa.toast.phone.verifySuccess.title'), description: t('mfa.toast.phone.verifySuccess.desc') });
    },
    onError: (e) => toast({ title: t('mfa.toast.error.phoneVerify'), description: e.message, variant: 'destructive' })
  });
}

export function useDisablePhoneMfa() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  return useMutation<{ success: boolean }, Error, { token: string }>({
    mutationFn: async (vars) => apiRequest('POST', '/api/mfa/phone/disable', vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/mfa/status'] });
      toast({ title: t('mfa.toast.phone.disabled.title'), description: t('mfa.toast.phone.disabled.desc') });
    },
    onError: (e) => toast({ title: t('mfa.toast.error.phoneDisable'), description: e.message, variant: 'destructive' })
  });
}

export function useConsumeRecoveryCode() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  return useMutation<{ success: boolean }, Error, { code: string }>({
    mutationFn: async (vars) => apiRequest('POST', '/api/mfa/recovery-code/consume', { code: vars.code }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/mfa/status'] });
      toast({ title: t('mfa.toast.recoveryUsed.title'), description: t('mfa.toast.recoveryUsed.desc') });
    },
    onError: (e) => toast({ title: t('mfa.toast.error.recovery'), description: e.message, variant: 'destructive' })
  });
}

// WebAuthn hooks
export function useWebAuthnRegisterOptions() {
  return useMutation<any, Error, void>({
    mutationFn: async () => apiRequest('GET', '/api/webauthn/register/options'),
  });
}

export function useWebAuthnRegisterVerify() {
  const qc = useQueryClient();
  return useMutation<any, Error, any>({
    mutationFn: async (payload) => apiRequest('POST', '/api/webauthn/register/verify', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/mfa/status'] }),
  });
}

export function useWebAuthnAuthOptions() {
  return useMutation<any, Error, void>({
    mutationFn: async () => apiRequest('GET', '/api/webauthn/auth/options'),
  });
}

export function useWebAuthnAuthVerify() {
  const qc = useQueryClient();
  return useMutation<any, Error, any>({
    mutationFn: async (payload) => apiRequest('POST', '/api/webauthn/auth/verify', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/mfa/status'] }),
  });
}

// Credential management
export interface WebAuthnCredentialSummary {
  id: string;
  credentialId: string;
  name: string | null;
  signCount: number;
  createdAt: string;
}

export function useWebAuthnCredentials() {
  return useQuery<WebAuthnCredentialSummary[]>({ queryKey: ['/api/webauthn/credentials'] });
}

export function useDeleteWebAuthnCredential() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  return useMutation<{ success: boolean }, Error, { id: string }>({
    mutationFn: async (vars) => apiRequest('DELETE', `/api/webauthn/credentials/${vars.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/webauthn/credentials'] });
      qc.invalidateQueries({ queryKey: ['/api/mfa/status'] });
      toast({ title: t('mfa.toast.webauthn.deleted.title'), description: t('mfa.toast.webauthn.deleted.desc') });
    },
    onError: (e) => toast({ title: t('mfa.toast.error.webauthnDelete'), description: e.message, variant: 'destructive' })
  });
}

export function useRenameWebAuthnCredential() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  return useMutation<{ success: boolean }, Error, { id: string; name: string }>({
    mutationFn: async ({ id, name }) => apiRequest('PATCH', `/api/webauthn/credentials/${id}`, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/webauthn/credentials'] });
      toast({ title: t('mfa.toast.webauthn.renamed.title'), description: t('mfa.toast.webauthn.renamed.desc') });
    },
    onError: (e) => toast({ title: t('mfa.toast.error.webauthnRename'), description: e.message, variant: 'destructive' })
  });
}
