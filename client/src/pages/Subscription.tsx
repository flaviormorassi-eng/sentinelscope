import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, CreditCard, ExternalLink, CheckCircle2, Loader2 } from 'lucide-react';
import { SUBSCRIPTION_TIERS, type SubscriptionTier } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useEffect } from 'react';

export default function Subscription() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Check for success parameter in URL
  const urlParams = new URLSearchParams(window.location.search);
  const paymentSuccess = urlParams.get('success') === 'true';

  useEffect(() => {
    if (paymentSuccess) {
      toast({
        title: t('subscription.success.title'),
        description: t('subscription.success.description'),
      });
      // Clean URL
      window.history.replaceState({}, '', '/subscription');
      // Refresh subscription data
      queryClient.invalidateQueries({ queryKey: ['/api/user/subscription'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    }
  }, [paymentSuccess, t, toast]);

  const { data: userSubscription, isLoading } = useQuery<{ 
    tier: SubscriptionTier;
    stripeSubscriptionId?: string | null;
    subscriptionStatus?: string | null;
    currentPeriodEnd?: string | null;
  }>({
    queryKey: ['/api/user/subscription'],
  });

  const billingPortalMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/stripe/create-billing-portal-session', {});
    },
    onSuccess: (data: any) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: t('subscription.error.title'),
        description: error.message || t('subscription.error.billingPortal'),
        variant: 'destructive',
      });
    },
  });

  const currentTier = userSubscription?.tier || 'individual';
  const hasActiveSubscription = userSubscription?.stripeSubscriptionId && 
    userSubscription?.subscriptionStatus === 'active';

  const handleChoosePlan = (tier: SubscriptionTier) => {
    setLocation(`/checkout?tier=${tier}`);
  };

  const handleManageBilling = () => {
    billingPortalMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('subscription.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('subscription.current')}: <strong>{t(`subscription.tiers.${currentTier}`)}</strong>
        </p>
      </div>

      {hasActiveSubscription && (
        <Alert data-testid="alert-active-subscription">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{t('subscription.active.message')}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManageBilling}
              disabled={billingPortalMutation.isPending}
              data-testid="button-manage-billing"
            >
              {billingPortalMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('subscription.loading')}
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {t('subscription.manageBilling')}
                  <ExternalLink className="ml-2 h-3 w-3" />
                </>
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {userSubscription?.currentPeriodEnd && (
        <div className="text-sm text-muted-foreground">
          {t('subscription.renewsOn')}: {new Date(userSubscription.currentPeriodEnd).toLocaleDateString()}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {(Object.entries(SUBSCRIPTION_TIERS) as [SubscriptionTier, typeof SUBSCRIPTION_TIERS[SubscriptionTier]][]).map(
          ([tierId, tier]) => {
            const isCurrentPlan = tierId === currentTier;
            const isMostPopular = tierId === 'smb';

            return (
              <Card
                key={tierId}
                className={`relative ${isMostPopular ? 'border-primary border-2' : ''}`}
                data-testid={`card-plan-${tierId}`}
              >
                {isMostPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="default">{t('subscription.mostPopular')}</Badge>
                  </div>
                )}

                <CardHeader>
                  <CardTitle className="text-2xl">{tier.name}</CardTitle>
                  <CardDescription>
                    <div className="mt-4">
                      <span className="text-4xl font-bold text-foreground">
                        ${tier.price}
                      </span>
                      <span className="text-muted-foreground">{t('subscription.perMonth')}</span>
                    </div>
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  {isCurrentPlan && hasActiveSubscription ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled
                      data-testid={`button-current-plan-${tierId}`}
                    >
                      {t('subscription.currentPlan')}
                    </Button>
                  ) : (
                    <Button
                      variant={isMostPopular ? 'default' : 'outline'}
                      className="w-full"
                      onClick={() => handleChoosePlan(tierId)}
                      data-testid={`button-choose-plan-${tierId}`}
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      {t('subscription.choosePlan')}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          }
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plan Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Individual:</strong> Perfect for personal use and small home setups. 
              Get real-time protection for up to 3 devices with essential threat detection.
            </p>
            <p>
              <strong>Small Business:</strong> Ideal for growing teams and small companies. 
              Protect up to 50 devices with advanced threat intelligence and priority support.
            </p>
            <p>
              <strong>Enterprise:</strong> Comprehensive security solution for large organizations. 
              Unlimited devices, AI-powered threat prediction, and 24/7 dedicated support.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
