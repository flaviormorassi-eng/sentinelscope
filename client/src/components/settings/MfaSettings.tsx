import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, QrCode, RotateCcw, Trash2, Lock } from 'lucide-react';
import { useMfaStatus, useEnrollTotp, useVerifyTotp, useRegenerateRecoveryCodes, useDisableTotp, useRequestPhoneCode, useVerifyPhoneCode, useDisablePhoneMfa, useWebAuthnRegisterOptions, useWebAuthnRegisterVerify, useWebAuthnAuthOptions, useWebAuthnAuthVerify, useWebAuthnCredentials, useDeleteWebAuthnCredential, useRenameWebAuthnCredential } from '@/hooks/useMfa';

// Helper functions for base64url <-> ArrayBuffer conversions without relying on spread iteration
function base64urlToUint8Array(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? 4 - (b64.length % 4) : 0;
  const padded = b64 + '='.repeat(pad);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function MfaSettings() {
  const { t } = useTranslation();
  const { data: status, isLoading: statusLoading } = useMfaStatus();
  const enroll = useEnrollTotp();
  const verify = useVerifyTotp();
  const regen = useRegenerateRecoveryCodes();
  const disable = useDisableTotp();
  const requestPhone = useRequestPhoneCode();
  const verifyPhone = useVerifyPhoneCode();
  const disablePhone = useDisablePhoneMfa();
  const regOpts = useWebAuthnRegisterOptions();
  const regVerify = useWebAuthnRegisterVerify();
  const authOpts = useWebAuthnAuthOptions();
  const authVerify = useWebAuthnAuthVerify();
  const credsQuery = useWebAuthnCredentials();
  const deleteCred = useDeleteWebAuthnCredential();
  const renameCred = useRenameWebAuthnCredential();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [showRecovery, setShowRecovery] = useState<string[] | null>(null);
  const [regenToken, setRegenToken] = useState('');
  const [disableToken, setDisableToken] = useState('');
  const [disableRecoveryCode, setDisableRecoveryCode] = useState('');
  // Phone MFA local state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneToken, setPhoneToken] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneRequested, setPhoneRequested] = useState(false);

  const startEnrollment = async () => {
    const r = await enroll.mutateAsync();
    setQrDataUrl(r.qrDataUrl);
    setOtpauthUrl(r.otpauthUrl);
  };

  const handleVerify = async () => {
    if (!token || token.length < 6) return;
    const resp = await verify.mutateAsync({ token });
    if (resp.recoveryCodes) {
      setShowRecovery(resp.recoveryCodes);
      // Clear enrollment visuals after success
      setQrDataUrl(null);
      setOtpauthUrl(null);
    }
    setToken('');
  };

  const handleRegenerate = async () => {
    if (!regenToken) return;
    const resp = await regen.mutateAsync({ token: regenToken });
    setShowRecovery(resp.recoveryCodes);
    setRegenToken('');
  };

  const handleDisable = async () => {
    await disable.mutateAsync({ token: disableToken || undefined, recoveryCode: disableRecoveryCode || undefined });
    setDisableToken('');
    setDisableRecoveryCode('');
    setShowRecovery(null);
    setQrDataUrl(null);
    setOtpauthUrl(null);
  };

  const lockedUntil = status?.lockedUntil ? new Date(status.lockedUntil) : null;
  const isLocked = lockedUntil ? lockedUntil.getTime() > Date.now() : false;
  const featurePhone = (import.meta as any).env?.VITE_FEATURE_PHONE_MFA === 'true';
  const webAuthnSupported = typeof window !== 'undefined' && 'PublicKeyCredential' in window && window.isSecureContext;

  const handleRequestPhone = async () => {
    if (!phoneNumber || !/^\+\d{7,15}$/.test(phoneNumber) || phoneToken.length !== 6) return;
    await requestPhone.mutateAsync({ phoneNumber, token: phoneToken });
    setPhoneRequested(true);
  };

  const handleVerifyPhone = async () => {
    if (phoneCode.length !== 6) return;
    await verifyPhone.mutateAsync({ code: phoneCode });
    setPhoneRequested(false);
    setPhoneCode('');
    setPhoneToken('');
  };

  const handleDisablePhone = async () => {
    if (phoneToken.length !== 6) return;
    await disablePhone.mutateAsync({ token: phoneToken });
    setPhoneToken('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.mfa.totp.title')}</CardTitle>
        <CardDescription>{t('settings.mfa.totp.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {statusLoading && <p className="text-sm text-muted-foreground">{t('settings.mfa.loadingStatus')}</p>}
        {status && (
          <div className="flex items-center gap-2">
            {status.totpEnabled ? (
              <Badge className="bg-green-600">{t('settings.mfa.status.enabled')}</Badge>
            ) : (
              <Badge variant="secondary">{t('settings.mfa.status.disabled')}</Badge>
            )}
            {isLocked && (
              <Badge variant="destructive" className="flex items-center gap-1"><Lock className="h-3 w-3" /> {t('settings.mfa.status.locked')}</Badge>
            )}
          </div>
        )}
        {!status?.totpEnabled && !qrDataUrl && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('settings.mfa.totp.notConfigured')}</p>
            <Button onClick={startEnrollment} disabled={enroll.isPending}>
              {enroll.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{t('settings.mfa.totp.startEnrollment')}
            </Button>
          </div>
        )}
        {qrDataUrl && (
          <div className="space-y-4">
            <Separator />
            <p className="text-sm">{t('settings.mfa.totp.scanInstruction')}</p>
            <img src={qrDataUrl} alt="TOTP QR" className="h-48 w-48 border rounded bg-white p-2" />
            <div className="space-y-2">
              <Label htmlFor="token">{t('settings.mfa.totp.codeLabel')}</Label>
              <Input id="token" value={token} onChange={(e) => setToken(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder={t('settings.mfa.totp.codePlaceholder') as string} />
              <Button onClick={handleVerify} disabled={verify.isPending || token.length !== 6} className="w-full">
                {verify.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{t('settings.mfa.totp.verifyEnable')}
              </Button>
            </div>
          </div>
        )}
        {status?.totpEnabled && (
          <div className="space-y-6">
            <Separator />
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2"><Shield className="h-4 w-4" /> {t('settings.mfa.recovery.title')}</h4>
              <p className="text-xs text-muted-foreground">{t('settings.mfa.recovery.description')}</p>
              {showRecovery ? (
                <div className="grid grid-cols-2 gap-2">
                  {showRecovery.map(code => (
                    <code key={code} className="text-xs bg-muted px-2 py-1 rounded font-mono">{code}</code>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t('settings.mfa.recovery.initialOnly')}</p>
              )}
              <div className="space-y-2 mt-2">
                <Label htmlFor="regenToken" className="text-xs">{t('settings.mfa.recovery.regenLabel')}</Label>
                <Input id="regenToken" value={regenToken} onChange={(e) => setRegenToken(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder={t('settings.mfa.totp.codePlaceholder') as string} />
                <Button variant="outline" onClick={handleRegenerate} disabled={regen.isPending || regenToken.length !== 6}>
                  {regen.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}<RotateCcw className="h-4 w-4 mr-2" />{t('settings.mfa.recovery.regenButton')}
                </Button>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2"><Trash2 className="h-4 w-4" /> {t('settings.mfa.disable.title')}</h4>
              <p className="text-xs text-muted-foreground">{t('settings.mfa.disable.description')}</p>
              <div className="grid gap-2 md:grid-cols-2">
                <Input value={disableToken} onChange={(e) => setDisableToken(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder={t('settings.mfa.disable.totpPlaceholder') as string} />
                <Input value={disableRecoveryCode} onChange={(e) => setDisableRecoveryCode(e.target.value.trim())} placeholder={t('settings.mfa.disable.recoveryPlaceholder') as string} />
              </div>
              <Button variant="destructive" onClick={handleDisable} disabled={disable.isPending || (!disableToken && !disableRecoveryCode)}>
                {disable.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{t('settings.mfa.disable.button')}
              </Button>
            </div>
            {/* WebAuthn security keys */}
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2"><Shield className="h-4 w-4" /> Security Keys (WebAuthn)</h4>
              <p className="text-xs text-muted-foreground">Register a hardware key or platform authenticator.</p>
              <p className="text-xs">Registered: {status?.webauthnCredsCount ?? 0}</p>
              {!webAuthnSupported && (
                <p className="text-xs text-destructive">WebAuthn requires a secure context (https) and a compatible browser.</p>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" disabled={!webAuthnSupported || regOpts.isPending || regVerify.isPending} onClick={async () => {
                  const opts = await regOpts.mutateAsync();
                  // Convert base64url to buffer where needed
                  const publicKey: any = { ...opts };
                  publicKey.challenge = base64urlToUint8Array(opts.challenge);
                  publicKey.user = { ...opts.user, id: base64urlToUint8Array(opts.user.id) };
                  if (publicKey.excludeCredentials) {
                    publicKey.excludeCredentials = publicKey.excludeCredentials.map((c: any) => ({ ...c, id: base64urlToUint8Array(c.id) }));
                  }
                  const cred: any = await navigator.credentials.create({ publicKey });
                  const attResp = {
                    id: cred.id,
                    rawId: arrayBufferToBase64url(cred.rawId as ArrayBuffer),
                    type: cred.type,
                    response: {
                      clientDataJSON: arrayBufferToBase64url(cred.response.clientDataJSON),
                      attestationObject: arrayBufferToBase64url(cred.response.attestationObject),
                    },
                    clientExtensionResults: (cred.getClientExtensionResults && cred.getClientExtensionResults()) || {},
                  };
                  await regVerify.mutateAsync(attResp);
                }}>
                  {regOpts.isPending || regVerify.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add security key
                </Button>
                <Button variant="secondary" disabled={!webAuthnSupported || authOpts.isPending || authVerify.isPending || (status?.webauthnCredsCount ?? 0) === 0} onClick={async () => {
                  const opts = await authOpts.mutateAsync();
                  const publicKey: any = { ...opts };
                  publicKey.challenge = base64urlToUint8Array(opts.challenge);
                  if (publicKey.allowCredentials) {
                    publicKey.allowCredentials = publicKey.allowCredentials.map((c: any) => ({ ...c, id: base64urlToUint8Array(c.id) }));
                  }
                  const assertion: any = await navigator.credentials.get({ publicKey });
                  const authResp = {
                    id: assertion.id,
                    rawId: arrayBufferToBase64url(assertion.rawId as ArrayBuffer),
                    type: assertion.type,
                    response: {
                      clientDataJSON: arrayBufferToBase64url(assertion.response.clientDataJSON),
                      authenticatorData: arrayBufferToBase64url(assertion.response.authenticatorData),
                      signature: arrayBufferToBase64url(assertion.response.signature),
                      userHandle: assertion.response.userHandle ? arrayBufferToBase64url(assertion.response.userHandle) : null,
                    },
                    clientExtensionResults: (assertion.getClientExtensionResults && assertion.getClientExtensionResults()) || {},
                  };
                  await authVerify.mutateAsync(authResp);
                }}>
                  {authOpts.isPending || authVerify.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Verify with security key
                </Button>
              </div>
              {/* Existing credentials list */}
              <div className="mt-4 space-y-2">
                <h5 className="text-xs font-semibold">Registered Keys</h5>
                {credsQuery.isLoading && <p className="text-xs text-muted-foreground">Loading...</p>}
                {!credsQuery.isLoading && (credsQuery.data?.length ?? 0) === 0 && <p className="text-xs text-muted-foreground">No security keys registered yet.</p>}
                <ul className="space-y-2">
                  {credsQuery.data?.map(c => {
                    const isEditing = editingId === c.id;
                    return (
                      <li key={c.id} className="flex flex-col gap-2 rounded border px-2 py-2 text-xs bg-muted/40">
                        <div className="flex items-center justify-between gap-2">
                          {!isEditing ? (
                            <span className="truncate max-w-[60%]" title={c.credentialId}>{c.name || t('settings.mfa.webauthn.credentialUnnamed')} · signCount={c.signCount}</span>
                          ) : (
                            <div className="flex items-center w-full gap-2">
                              <Input
                                autoFocus
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value.slice(0,60))}
                                placeholder={t('settings.mfa.webauthn.renamePlaceholder') as string}
                                className="h-7 text-xs"
                              />
                              <Button size="sm" variant="default" disabled={renameCred.isPending || editingName.trim().length === 0} onClick={async () => {
                                await renameCred.mutateAsync({ id: c.id, name: editingName.trim() });
                                setEditingId(null);
                                setEditingName('');
                              }}>{t('settings.mfa.webauthn.renameSave')}</Button>
                              <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditingName(''); }}>{t('common.cancel')}</Button>
                            </div>
                          )}
                          {!isEditing && (
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" disabled={renameCred.isPending} onClick={() => { setEditingId(c.id); setEditingName(c.name || ''); }}>{t('common.edit')}</Button>
                              <Button size="sm" variant="destructive" disabled={deleteCred.isPending} onClick={() => deleteCred.mutate({ id: c.id })}>{t('settings.mfa.webauthn.deleteButton')}</Button>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        )}
        {isLocked && (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-xs">
            {t('settings.mfa.lockedNotice', { time: lockedUntil?.toLocaleTimeString() })}
          </div>
        )}
        {featurePhone && (
          <div className="space-y-3 mt-4">
            <Separator />
            <h4 className="font-medium">{t('settings.mfa.phoneTitle')}</h4>
            <p className="text-xs text-muted-foreground">{t('settings.mfa.phoneDescription')}</p>
            {status?.phoneEnabled ? (
              <div className="space-y-2">
                <Badge className="bg-green-600">{t('settings.mfa.phone.enabledBadge')}</Badge>
                <div className="grid gap-2 md:grid-cols-2">
                  <Input value={phoneToken} onChange={(e) => setPhoneToken(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder={t('settings.mfa.phone.disableTotpPlaceholder') as string} />
                  <Button variant="destructive" disabled={disablePhone.isPending || phoneToken.length !== 6} onClick={handleDisablePhone}>
                    {disablePhone.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{t('settings.mfa.phone.disableButton')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Badge variant="secondary">{t('settings.mfa.phone.disabledBadge')}</Badge>
                {!phoneRequested && (
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">{t('settings.mfa.phone.inputLabel')}</Label>
                    <Input id="phoneNumber" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.trim())} placeholder={t('settings.mfa.phone.inputPlaceholder') as string} />
                    <Label htmlFor="phoneToken" className="text-xs">{t('settings.mfa.phone.totpLabel')}</Label>
                    <Input id="phoneToken" value={phoneToken} onChange={(e) => setPhoneToken(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder={t('settings.mfa.totp.codePlaceholder') as string} />
                    <Button disabled={requestPhone.isPending || phoneToken.length !== 6 || !/^\+\d{7,15}$/.test(phoneNumber)} onClick={handleRequestPhone} className="w-full">
                      {requestPhone.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{t('settings.mfa.phone.requestButton')}
                    </Button>
                  </div>
                )}
                {phoneRequested && (
                  <div className="space-y-2">
                    <Label htmlFor="phoneCode">{t('settings.mfa.phone.codeLabel')}</Label>
                    <Input id="phoneCode" value={phoneCode} onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder={t('settings.mfa.phone.codePlaceholder') as string} />
                    <Button disabled={verifyPhone.isPending || phoneCode.length !== 6} onClick={handleVerifyPhone} className="w-full">
                      {verifyPhone.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{t('settings.mfa.phone.verifyButton')}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        {t('settings.mfa.footerNote')}
      </CardFooter>
    </Card>
  );
}

export default MfaSettings;