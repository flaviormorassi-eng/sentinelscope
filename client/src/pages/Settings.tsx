import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Save, AlertCircle, Clock, CreditCard, Phone, Shield, Loader2, Trash2, FileText } from 'lucide-react';
import MfaSettings from '@/components/settings/MfaSettings';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Link } from 'wouter';
import { Eye, EyeOff } from 'lucide-react';
import {
  getMultiFactorResolver,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';

interface UserPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  alertThreshold: string;
  monitoringMode: string;
  browsingMonitoringEnabled: boolean;
  browsingHistoryEnabled: boolean;
  browsingConsentGivenAt: string | null;
}

interface RealMonitoringAccess {
  canAccess: boolean;
  reason: 'paid_subscription' | 'active_trial' | 'no_access';
  trialStatus?: {
    isActive: boolean;
    expiresAt: string | null;
    hoursRemaining: number | null;
  };
}

// Extend FirebaseUser type to include multiFactor for local use
type UserWithMultiFactor = {
  multiFactor?: {
    enrolledFactors: { phoneNumber?: string }[];
    enroll: (assertion: any, displayName?: string | null) => Promise<void>;
  };
  reload: () => Promise<void>;
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
};

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { user: rawUser, loading: authLoading, deleteAccount } = useAuth();
  const user = rawUser as UserWithMultiFactor | null;
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isMfaDialogOpen, setIsMfaDialogOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [language, setLanguage] = useState(i18n.language);
  const [selectedTheme, setSelectedTheme] = useState(theme);
  const [isPurgeDialogOpen, setIsPurgeDialogOpen] = useState(false);
  const [hasExported, setHasExported] = useState(false);

  const generateReportMutation = useMutation({
    mutationFn: async () => {
      // Force PDF for this mandatory backup
      return await apiRequest('POST', '/api/reports/generate', { type: 'detailed', period: 'custom', format: 'pdf' });
    },
    onSuccess: (data: any) => {
      if (data.downloadUrl) {
         const link = document.createElement('a');
         link.href = data.downloadUrl;
         link.download = data.filename || `security-history-backup-${Date.now()}.pdf`;
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
      }
      setHasExported(true);
      toast({ title: t('common.success', "Success"), description: "Backup downloaded. You may now purge your data." });
    },
    onError: (e: any) => {
       toast({ title: t('common.error', "Error"), description: e.message || "Export failed", variant: "destructive" });
    }
  });

  const purgeDataMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/user/purge-data');
    },
    onSuccess: () => {
      setIsPurgeDialogOpen(false);
      setHasExported(false); // Reset
      toast({ title: "Data Purged", description: "All security history has been permanently deleted." });
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/threats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
    },
    onError: (e: any) => {
      toast({ title: t('common.error', "Error"), description: e.message, variant: "destructive" });
    }
  });

  const { data: preferences } = useQuery<UserPreferences>({
    queryKey: ['/api/user/preferences'],
  });

  const { data: realMonitoringAccess } = useQuery<RealMonitoringAccess>({
    queryKey: ['/api/user/real-monitoring-access'],
  });

  const mfaEnrolled = !!(user && user.multiFactor && user.multiFactor.enrolledFactors && user.multiFactor.enrolledFactors.length > 0);

  const [emailNotifications, setEmailNotifications] = useState(preferences?.emailNotifications ?? true);
  const [pushNotifications, setPushNotifications] = useState(preferences?.pushNotifications ?? true);
  const [alertThreshold, setAlertThreshold] = useState(preferences?.alertThreshold ?? 'medium');
  const [monitoringMode, setMonitoringMode] = useState(preferences?.monitoringMode ?? 'demo');
  const [browsingMonitoringEnabled, setBrowsingMonitoringEnabled] = useState(preferences?.browsingMonitoringEnabled ?? false);
  const [browsingHistoryEnabled, setBrowsingHistoryEnabled] = useState(preferences?.browsingHistoryEnabled ?? false);

  useEffect(() => {
    if (preferences) {
      setEmailNotifications(preferences.emailNotifications);
      setPushNotifications(preferences.pushNotifications);
      setAlertThreshold(preferences.alertThreshold);
      setMonitoringMode(preferences.monitoringMode);
      setBrowsingMonitoringEnabled(preferences.browsingMonitoringEnabled);
      setBrowsingHistoryEnabled(preferences.browsingHistoryEnabled);
    }
  }, [preferences]);

  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PUT', '/api/user/preferences', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] });
      toast({
        title: t('settings.saved'),
        description: "Your settings have been updated successfully",
      });
    },
    onError: (error: any, variables: any) => {
      // If switching to real mode failed (e.g., trial expired), revert UI to demo
      if (variables?.monitoringMode === 'real') {
        setMonitoringMode('demo');
      }
      const msg = String(error?.message || 'Failed to update settings');
      const friendly = msg.includes('Real monitoring access denied')
        ? 'Real monitoring access denied or trial expired. Please upgrade to continue.'
        : msg;
      toast({ title: 'Error', description: friendly, variant: 'destructive' });
    },
  });

  const handleSave = () => {
    // Save language
    i18n.changeLanguage(language);
    localStorage.setItem('language', language);

    // Save theme
    setTheme(selectedTheme);

    // Save preferences
    updatePreferencesMutation.mutate({
      emailNotifications,
      pushNotifications,
      alertThreshold,
      monitoringMode,
      browsingMonitoringEnabled,
      browsingHistoryEnabled,
    }, {
      onError: (error) => {
        // Additional UI hint near the Monitoring section can be added later
      }
    });
  };

  const handleSendVerificationCode = async () => {
    if (!user) return;
    try {
      const phoneProvider = new PhoneAuthProvider(auth);
      const verifier = window.recaptchaVerifier;
        const verificationId = await phoneProvider.verifyPhoneNumber(
          phoneNumber,
          verifier
        );
      setVerificationId(verificationId);
      toast({ title: 'Code Sent', description: 'A verification code has been sent to your phone.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleVerifyAndEnroll = async () => {
    if (!user || !verificationId) return;
    try {
      const cred = PhoneAuthProvider.credential(verificationId, verificationCode);
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);
      if (user && user.multiFactor) {
        await user.multiFactor.enroll(multiFactorAssertion, phoneNumber);
      }
      
      // Force a refresh of the user object to get new MFA state
      await user.reload();
      queryClient.invalidateQueries({ queryKey: [`/api/user/${user.uid}`] });

      setIsMfaDialogOpen(false);
      setPhoneNumber('');
      setVerificationId(null);
      setVerificationCode('');
      toast({ title: 'Success', description: '2FA has been enabled successfully.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleMfaDialogClose = () => {
    setIsMfaDialogOpen(false);
    setVerificationId(null);
  };

  const handleDeleteAccount = async () => {
    const success = await deleteAccount(deletePassword);
    if (success) {
      setIsDeleteDialogOpen(false);
      setDeletePassword('');
    }
  };


  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('settings.profile')}</CardTitle>
            <CardDescription>Your account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user?.photoURL || undefined} />
                <AvatarFallback className="text-lg">
                  {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{user?.displayName || 'User'}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('settings.preferences')}</CardTitle>
            <CardDescription>Customize your experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="language">{t('settings.language')}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="language" data-testid="select-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">{t('settings.languages.en')}</SelectItem>
                  <SelectItem value="pt">{t('settings.languages.pt')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme">{t('settings.theme')}</Label>
              <Select value={selectedTheme} onValueChange={(v) => setSelectedTheme(v as 'light' | 'dark')}>
                <SelectTrigger id="theme" data-testid="select-theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t('settings.themes.light')}</SelectItem>
                  <SelectItem value="dark">{t('settings.themes.dark')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.notifications')}</CardTitle>
          <CardDescription>Manage how you receive alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications">{t('settings.emailNotifications')}</Label>
              <p className="text-sm text-muted-foreground">
                Receive threat alerts via email
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
              data-testid="switch-email-notifications"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push-notifications">{t('settings.pushNotifications')}</Label>
              <p className="text-sm text-muted-foreground">
                Receive push notifications for critical threats
              </p>
            </div>
            <Switch
              id="push-notifications"
              checked={pushNotifications}
              onCheckedChange={setPushNotifications}
              data-testid="switch-push-notifications"
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="alert-threshold">{t('settings.alertThreshold')}</Label>
            <Select value={alertThreshold} onValueChange={setAlertThreshold}>
              <SelectTrigger id="alert-threshold" data-testid="select-alert-threshold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{t('settings.thresholds.low')}</SelectItem>
                <SelectItem value="medium">{t('settings.thresholds.medium')}</SelectItem>
                <SelectItem value="high">{t('settings.thresholds.high')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Control which threats trigger notifications
            </p>
          </div>
        </CardContent>
      </Card>

      <MfaSettings />

      <Card>
        <CardHeader>
          <CardTitle>Monitoring Mode</CardTitle>
          <CardDescription>Choose between demo data or real-time monitoring</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="monitoring-mode">Data Source</Label>
            <Select value={monitoringMode} onValueChange={setMonitoringMode}>
              <SelectTrigger id="monitoring-mode" data-testid="select-monitoring-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="demo">Demo Mode (Simulated Data)</SelectItem>
                <SelectItem value="real">Real Monitoring (Live Data)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {monitoringMode === 'demo' 
                ? 'Using simulated threat data for demonstration purposes'
                : 'Connected to real-time security monitoring sources'}
            </p>
          </div>

          {/* Access Status Alerts */}
          {realMonitoringAccess && monitoringMode === 'real' && (
            <>
              {realMonitoringAccess.reason === 'paid_subscription' && (
                <Alert className="border-green-500/50 bg-green-500/10">
                  <CreditCard className="h-4 w-4 text-green-500" />
                  <AlertTitle className="text-green-500">Paid Subscription Active</AlertTitle>
                  <AlertDescription className="text-muted-foreground">
                    You have unlimited access to real monitoring with your current plan.
                  </AlertDescription>
                </Alert>
              )}

              {realMonitoringAccess.reason === 'active_trial' && realMonitoringAccess.trialStatus && (
                <Alert className="border-yellow-500/50 bg-yellow-500/10">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <AlertTitle className="text-yellow-500">Free Trial Active</AlertTitle>
                  <AlertDescription className="text-muted-foreground">
                    {realMonitoringAccess.trialStatus.hoursRemaining} hours remaining. 
                    <Link href="/subscription">
                      <span className="text-yellow-500 underline cursor-pointer">Upgrade now</span>
                    </Link>
                    {' '}to continue after trial ends.
                  </AlertDescription>
                </Alert>
              )}

              {realMonitoringAccess.reason === 'no_access' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Trial Expired</AlertTitle>
                  <AlertDescription>
                    Your 24-hour free trial has ended. 
                    <Link href="/subscription">
                      <span className="text-destructive-foreground underline cursor-pointer">Upgrade to a paid plan</span>
                    </Link>
                    {' '}to continue using real monitoring.
                  </AlertDescription>
                </Alert>
              )}

              {realMonitoringAccess.canAccess && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-medium mb-2">📡 Real Monitoring Active</p>
                  <p className="text-sm text-muted-foreground">
                    Configure your data sources in the Event Sources page to start receiving real-time security events.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.privacy.title')}</CardTitle>
          <CardDescription>{t('settings.privacy.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="browsing-monitoring">{t('settings.privacy.browsingMonitoring')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.privacy.browsingMonitoringDesc')}
              </p>
            </div>
            <Switch
              id="browsing-monitoring"
              checked={browsingMonitoringEnabled}
              onCheckedChange={setBrowsingMonitoringEnabled}
              data-testid="switch-browsing-monitoring"
            />
          </div>

          {browsingMonitoringEnabled && (
            <>
              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="browsing-history">{t('settings.privacy.browsingHistory')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.privacy.browsingHistoryDesc')}
                  </p>
                </div>
                <Switch
                  id="browsing-history"
                  checked={browsingHistoryEnabled}
                  onCheckedChange={setBrowsingHistoryEnabled}
                  data-testid="switch-browsing-history"
                />
              </div>

              <Alert className="border-blue-500/50 bg-blue-500/10">
                <AlertCircle className="h-4 w-4 text-blue-500" />
                <AlertTitle className="text-blue-500">{t('settings.privacy.privacyNote')}</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  {t('settings.privacy.privacyNoteText')}
                </AlertDescription>
              </Alert>

              {preferences?.browsingConsentGivenAt && (
                <p className="text-sm text-muted-foreground">
                  {t('settings.privacy.consent')}: {new Date(preferences.browsingConsentGivenAt).toLocaleDateString()}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Data Management
            </CardTitle>
            <CardDescription>
              Manage your security logs and history retention.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Purge Security History</Label>
                <p className="text-sm text-muted-foreground">
                  Permanently delete all threat logs, alerts, and browsing activity.
                </p>
              </div>
              <Dialog open={isPurgeDialogOpen} onOpenChange={setIsPurgeDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">Purge Data</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Purge Security Data</DialogTitle>
                    <DialogDescription>
                      This action cannot be undone. All your security history will be permanently deleted from our servers.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <Alert variant={hasExported ? "default" : "destructive"}>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Requirement</AlertTitle>
                      <AlertDescription>
                        To prevent accidental data loss, you must download a PDF report of your history before purging.
                      </AlertDescription>
                    </Alert>

                    {!hasExported && (
                      <Button 
                        onClick={() => generateReportMutation.mutate()} 
                        disabled={generateReportMutation.isPending}
                        className="w-full"
                        variant="secondary"
                      >
                        {generateReportMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <FileText className="mr-2 h-4 w-4" />
                        Step 1: Download PDF Backup
                      </Button>
                    )}

                    {hasExported && (
                      <div className="flex items-center gap-2 text-green-600 text-sm font-medium p-3 bg-green-50 rounded-md border border-green-200">
                         <Shield className="h-4 w-4" /> Backup Verified
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsPurgeDialogOpen(false)}>Cancel</Button>
                    <Button 
                      variant="destructive" 
                      onClick={() => purgeDataMutation.mutate()}
                      disabled={!hasExported || purgeDataMutation.isPending}
                    >
                      {purgeDataMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Step 2: Confirm Purge
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">{t('settings.deleteAccount.title')}</CardTitle>
          <CardDescription>{t('settings.deleteAccount.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" data-testid="button-delete-account">
                {t('settings.deleteAccount.button')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('settings.deleteAccount.dialogTitle')}</DialogTitle>
                <DialogDescription>
                  {t('settings.deleteAccount.dialogDescription')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="delete-password">Password</Label>
                <div className="relative">
                  <Input
                    id="delete-password"
                    type={showPassword ? 'text' : 'password'}
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={authLoading || !deletePassword}
                >
                  {authLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t('settings.deleteAccount.confirmButton')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={updatePreferencesMutation.isPending}
          size="lg"
          data-testid="button-save-settings"
        >
          <Save className="h-4 w-4 mr-2" />
          {t('settings.save')}
        </Button>
      </div>
    </div>
  );
}

declare global { interface Window { recaptchaVerifier: RecaptchaVerifier; } }
