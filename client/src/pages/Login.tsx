import { useState } from 'react';
import { Shield, Mail, Lock } from 'lucide-react';
import { SiGoogle } from 'react-icons/si';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';

export default function Login() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset, loading } = useAuth();
  const { t } = useTranslation();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (isForgotPassword) {
      sendPasswordReset(email).then((success) => {
        if (success) {
          setIsForgotPassword(false);
        }
      });
    } else if (isSignUp) {
      signUpWithEmail(email, password);
    } else {
      signInWithEmail(email, password);
    }
  };

  const toggleView = (view: 'login' | 'signup' | 'forgot') => {
    if (view === 'signup') {
      setIsSignUp(true);
      setIsForgotPassword(false);
    } else if (view === 'forgot') {
      setIsSignUp(false);
      setIsForgotPassword(true);
    } else {
      setIsSignUp(false);
      setIsForgotPassword(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4 flex gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="h-10 w-10 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-bold">{t('app.name')}</CardTitle>
            <CardDescription className="text-base">
              {isForgotPassword ? t('auth.resetPasswordInstructions') : t('auth.welcomeMessage')}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-9" />
              </div>
            </div>
            {!isForgotPassword && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t('auth.password')}</Label>
                  {!isSignUp && (
                    <Button variant="ghost" type="button" className="p-0 h-auto text-xs underline" onClick={() => toggleView('forgot')}>
                      {t('auth.forgotPassword')}
                    </Button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required={!isForgotPassword} className="pl-9" />
                </div>
              </div>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? t('auth.loggingIn') : (isForgotPassword ? t('auth.resetPassword') : (isSignUp ? t('auth.signUp') : t('auth.login')))}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                OR
              </span>
            </div>
          </div>

          <Button
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full min-h-12"
            size="lg"
            data-testid="button-google-signin"
          >
            <SiGoogle className="mr-2 h-5 w-5" />
            {loading ? t('auth.loggingIn') : t('auth.loginWithGoogle')}
          </Button>

          <div className="text-center text-sm">
            {isForgotPassword ? (
              <Button variant="ghost" className="p-0 h-auto underline" onClick={() => toggleView('login')}>
                {t('auth.login')}
              </Button>
            ) : (
              <>
                <span className="text-muted-foreground">
                  {isSignUp ? t('auth.haveAccount') : t('auth.noAccount')}{' '}
                </span>
                <Button variant="ghost" className="p-0 h-auto underline" onClick={() => toggleView(isSignUp ? 'login' : 'signup')}>
                  {isSignUp ? t('auth.login') : t('auth.signUp')}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
