import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { SUBSCRIPTION_TIERS, type SubscriptionTier } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

export default function Subscription() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const { data: userSubscription } = useQuery<{ tier: SubscriptionTier }>({
    queryKey: ['/api/user/subscription'],
  });

  const changePlanMutation = useMutation({
    mutationFn: async (tier: SubscriptionTier) => {
      return await apiRequest('POST', '/api/user/subscription', { tier });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/subscription'] });
      toast({
        title: "Success",
        description: "Subscription plan updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update subscription",
        variant: "destructive",
      });
    },
  });

  const currentTier = userSubscription?.tier || 'individual';

  const handleChangePlan = (tier: SubscriptionTier) => {
    changePlanMutation.mutate(tier);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('subscription.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('subscription.current')}: <strong>{t(`subscription.tiers.${currentTier}`)}</strong>
        </p>
      </div>

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
                  {isCurrentPlan ? (
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
                      onClick={() => handleChangePlan(tierId)}
                      disabled={changePlanMutation.isPending}
                      data-testid={`button-choose-plan-${tierId}`}
                    >
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
              <strong>Individual:</strong> Perfect for personal use and small home networks. 
              Get real-time protection for up to 5 devices with essential threat detection.
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
