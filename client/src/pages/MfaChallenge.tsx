import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound, RotateCcw } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import { useMfaStatus, useVerifyTotp, useConsumeRecoveryCode, useWebAuthnAuthOptions, useWebAuthnAuthVerify } from '@/hooks/useMfa';
import { replayAllMfaFailedRequests, hasPendingMfaReplay } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Separator } from '@/components/ui/separator';

export function MfaChallenge({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: status } = useMfaStatus();
  const verify = useVerifyTotp();
  const consumeRecovery = useConsumeRecoveryCode();
  const getWebAuthnOptions = useWebAuthnAuthOptions();
  const verifyWebAuthn = useWebAuthnAuthVerify();
  const { toast } = useToast();
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [mode, setMode] = useState<'totp' | 'recovery'>('totp');

  const lockedUntil = status?.lockedUntil ? new Date(status.lockedUntil) : null;
  const isLocked = lockedUntil ? lockedUntil.getTime() > Date.now() : false;
  const hasWebAuthn = (status?.webauthnCredsCount || 0) > 0;

  const handleSuccess = async () => {
    // Refetch queries globally to recover blocked admin/compliance requests
    if (hasPendingMfaReplay()) {
      const { successCount, total } = await replayAllMfaFailedRequests();
      if (successCount > 0) {
        toast({ title: t('mfa.toast.replaySuccess.title'), description: t('mfa.toast.replaySuccess.desc', { success: successCount, total }) });
      }
    }
    await qc.invalidateQueries();
    onClose();
  };

  const handleVerifyTotp = async () => {
    if (totpCode.length === 6 && !isLocked) {
      try {
        await verify.mutateAsync({ token: totpCode });
        await handleSuccess();
      } catch (err) {
        // Error handled by query mutation logic (toast usually)
      }
    }
  };

  const handleConsumeRecovery = async () => {
    if (recoveryCode.trim().length > 0) {
      try {
        await consumeRecovery.mutateAsync({ code: recoveryCode.trim() });
        await handleSuccess();
      } catch (err) { }
    }
  };

  const handleWebAuthn = async () => {
    try {
      const options = await getWebAuthnOptions.mutateAsync();
      const asseResp = await startAuthentication(options);
      await verifyWebAuthn.mutateAsync(asseResp);
      await handleSuccess();
    } catch (error: any) {
      console.error(error);
      const isLockedError = error.message?.includes('423') || error.response?.status === 423;
      toast({ 
        title: isLockedError ? t('mfa.error.locked') : t('mfa.error.verificationFailed'), 
        variant: "destructive" 
      });
    }
  };

  const loading = verify.isPending || consumeRecovery.isPending || getWebAuthnOptions.isPending || verifyWebAuthn.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[450px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t('auth.mfaRequired')}</DialogTitle>
          <DialogDescription>
            {mode === 'totp' ? t('mfa.challenge.enterTotp') : t('mfa.challenge.enterRecovery')}
          </DialogDescription>
        </DialogHeader>
        {isLocked && (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-xs mb-2">
            {t('mfa.challenge.locked', { time: lockedUntil?.toLocaleTimeString() })}
          </div>
        )}
        <div className="grid gap-4 py-2">
          {mode === 'totp' ? (
            <div className="flex flex-col items-center gap-4">
              <Label htmlFor="totp" className="sr-only">{t('mfa.challenge.totpLabel')}</Label>
              <InputOTP
                maxLength={6}
                value={totpCode}
                onChange={(value) => setTotpCode(value.replace(/\D/g,'').slice(0,6))}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
              <Button variant="ghost" size="sm" onClick={() => setMode('recovery')} className="text-xs underline">{t('mfa.challenge.useRecoveryInstead')}</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="recovery">{t('mfa.challenge.recoveryLabel')}</Label>
              <Input id="recovery" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} placeholder={t('mfa.challenge.recoveryPlaceholder') as string} />
              <Button variant="ghost" size="sm" onClick={() => setMode('totp')} className="text-xs underline">{t('mfa.challenge.backToTotp')}</Button>
            </div>
          )}

          {hasWebAuthn && !isLocked && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t('common.or')}
                  </span>
                </div>
              </div>
              <Button variant="secondary" className="w-full" onClick={handleWebAuthn} disabled={loading}>
                <KeyRound className="mr-2 h-4 w-4" />
                {t('mfa.challenge.useSecurityKey')}
              </Button>
            </>
          )}
        </div>
        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={onClose} disabled={loading}>{t('common.cancel')}</Button>
          {mode === 'totp' ? (
            <Button onClick={handleVerifyTotp} disabled={loading || totpCode.length !== 6 || isLocked}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('mfa.challenge.verify')}
            </Button>
          ) : (
            <Button onClick={handleConsumeRecovery} disabled={loading || recoveryCode.trim().length === 0}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('mfa.challenge.useRecovery')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}