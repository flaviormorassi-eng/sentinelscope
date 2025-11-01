import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Loader2, CreditCard, Shield, Lock } from 'lucide-react';
import { SUBSCRIPTION_TIERS, type SubscriptionTier } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

function CheckoutForm({ tier, clientSecret }: { tier: SubscriptionTier; clientSecret: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const tierInfo = SUBSCRIPTION_TIERS[tier];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/subscription?success=true`,
      },
    });

    if (error) {
      setErrorMessage(error.message || t('checkout.error.payment'));
      toast({
        title: t('checkout.error.title'),
        description: error.message || t('checkout.error.payment'),
        variant: 'destructive',
      });
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">{t('checkout.plan')}</span>
          <span className="font-semibold">{tierInfo.name}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">{t('checkout.price')}</span>
          <span className="text-2xl font-bold">${tierInfo.price}/{t('subscription.month')}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" />
          <span>{t('checkout.secure')}</span>
        </div>
        
        <PaymentElement />
      </div>

      {errorMessage && (
        <Alert variant="destructive" data-testid="alert-payment-error">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <Button
          type="submit"
          className="w-full"
          disabled={!stripe || isProcessing}
          data-testid="button-complete-payment"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('checkout.processing')}
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              {t('checkout.pay')} ${tierInfo.price}
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setLocation('/subscription')}
          disabled={isProcessing}
          data-testid="button-cancel-checkout"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('checkout.cancel')}
        </Button>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Shield className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <p>{t('checkout.terms')}</p>
      </div>
    </form>
  );
}

export default function Checkout() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get tier from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const tier = (urlParams.get('tier') || 'individual') as SubscriptionTier;

  // Validate tier and redirect if invalid
  const isValidTier = ['individual', 'smb', 'enterprise'].includes(tier);
  
  useEffect(() => {
    if (!isValidTier) {
      setLocation('/subscription');
    }
  }, [isValidTier, setLocation]);

  // Early return with loading state for invalid tier
  if (!isValidTier) {
    return (
      <div className="container max-w-2xl mx-auto p-6">
        <div className="text-center">
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  const tierInfo = SUBSCRIPTION_TIERS[tier];

  useEffect(() => {
    const createSubscription = async () => {
      try {
        const response = await apiRequest('POST', '/api/stripe/create-subscription', { tier });
        
        if (response.clientSecret) {
          setClientSecret(response.clientSecret);
        } else {
          throw new Error('No client secret received');
        }
      } catch (err: any) {
        console.error('Checkout error:', err);
        setError(err.message || t('checkout.error.init'));
      }
    };

    createSubscription();
  }, [tier, t]);

  if (error) {
    return (
      <div className="container max-w-2xl mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => setLocation('/subscription')}
          data-testid="button-back-to-plans"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('checkout.backToPlans')}
        </Button>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="container max-w-2xl mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">{t('checkout.loading')}</p>
        </div>
      </div>
    );
  }

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
    },
  };

  return (
    <div className="container max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-checkout-title">
          {t('checkout.title')}
        </h1>
        <p className="text-muted-foreground mt-2">{t('checkout.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('checkout.cardTitle')}</CardTitle>
          <CardDescription>{t('checkout.cardDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Elements stripe={stripePromise} options={options}>
            <CheckoutForm tier={tier} clientSecret={clientSecret} />
          </Elements>
        </CardContent>
      </Card>

      <div className="mt-6 space-y-4">
        <h2 className="font-semibold">{t('checkout.features.title')}</h2>
        <ul className="space-y-2">
          {tierInfo.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <Shield className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
