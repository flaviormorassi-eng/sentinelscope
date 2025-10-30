import { Shield } from 'lucide-react';
import { SiGoogle } from 'react-icons/si';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';

export default function Login() {
  const { signInWithGoogle, loading } = useAuth();
  const { t } = useTranslation();

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
              {t('auth.welcomeMessage')}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
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

          <div className="text-center text-sm text-muted-foreground">
            <p>{t('app.tagline')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
