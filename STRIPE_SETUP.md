# Stripe Product Setup Guide for SentinelScope

This guide will help you create the subscription products and prices in your Stripe Dashboard to enable payments for SentinelScope.

## Prerequisites
- A Stripe account (sign up at https://stripe.com if you don't have one)
- Access to your Stripe Dashboard (https://dashboard.stripe.com)

## Step 1: Create Products

1. **Go to Products Page**
   - Visit https://dashboard.stripe.com/products
   - Click "+ Add product" button

2. **Create Individual Plan**
   - Name: `SentinelScope Individual`
   - Description: `Real-time cybersecurity monitoring for personal use - up to 3 devices`
   - Pricing model: `Recurring`
   - Price: `$5.00 USD`
   - Billing period: `Monthly`
   - Click "Save product"
   - **Important**: Copy the Price ID (starts with `price_...`) - you'll need this later

3. **Create Small Business Plan**
   - Name: `SentinelScope Small Business`
   - Description: `Advanced threat intelligence for growing teams - up to 50 devices`
   - Pricing model: `Recurring`
   - Price: `$49.99 USD`
   - Billing period: `Monthly`
   - Click "Save product"
   - **Important**: Copy the Price ID (starts with `price_...`)

4. **Create Enterprise Plan**
   - Name: `SentinelScope Enterprise`
   - Description: `Comprehensive security solution for large organizations - unlimited devices`
   - Pricing model: `Recurring`
   - Price: `$199.99 USD`
   - Billing period: `Monthly`
   - Click "Save product"
   - **Important**: Copy the Price ID (starts with `price_...`)

## Step 2: Configure Price IDs in Application

You'll need to add the Price IDs to your application. There are two approaches:

### Option A: Environment Variables (Recommended for Production)
Add these to your Replit Secrets or `.env` file:
```
STRIPE_PRICE_INDIVIDUAL=price_xxxxxxxxxxxxx
STRIPE_PRICE_SMB=price_xxxxxxxxxxxxx
STRIPE_PRICE_ENTERPRISE=price_xxxxxxxxxxxxx
```

### Option B: Hardcode in Schema (Quick Testing)
Update `shared/schema.ts` to add the Price IDs directly to the subscription tiers:
```typescript
export const SUBSCRIPTION_TIERS = {
  individual: {
    name: "Individual",
    price: 5,
    stripePriceId: "price_xxxxxxxxxxxxx", // Your Individual Price ID
    features: [...]
  },
  smb: {
    name: "Small Business",
    price: 49.99,
    stripePriceId: "price_xxxxxxxxxxxxx", // Your SMB Price ID
    features: [...]
  },
  enterprise: {
    name: "Enterprise",
    price: 199.99,
    stripePriceId: "price_xxxxxxxxxxxxx", // Your Enterprise Price ID
    features: [...]
  },
};
```

## Step 3: Configure Webhooks (Important!)

Webhooks allow Stripe to notify your application about subscription events (payments, cancellations, etc.).

1. **Go to Webhooks Page**
   - Visit https://dashboard.stripe.com/webhooks
   - Click "+ Add endpoint"

2. **Configure Webhook**
   - Endpoint URL: `https://your-replit-url.replit.dev/api/stripe/webhook`
   - Description: `SentinelScope subscription events`
   - Events to send:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Click "Add endpoint"

3. **Get Webhook Secret** (Optional but recommended for production)
   - After creating the endpoint, click "Reveal" under "Signing secret"
   - Copy the secret (starts with `whsec_...`)
   - Add to Replit Secrets: `STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx`

## Step 4: Test Your Setup

### Using Test Mode
1. Make sure you're using **test keys** (pk_test_ and sk_test_)
2. Use test card number: `4242 4242 4242 4242`
3. Use any future expiry date (e.g., 12/25)
4. Use any 3-digit CVC (e.g., 123)
5. Use any ZIP code (e.g., 12345)

### Test the Full Flow
1. Navigate to the Subscription page in your app
2. Click "Choose Plan" for any tier
3. Complete the checkout with test card
4. Verify subscription appears as "active" in Stripe Dashboard
5. Check that your user's subscription status updates in the app

## Step 5: Going Live

When you're ready to accept real payments:

1. **Activate Your Stripe Account**
   - Complete business verification in Stripe Dashboard
   - Add bank account for payouts

2. **Switch to Live Keys**
   - Replace test keys with live keys in Replit Secrets
   - `VITE_STRIPE_PUBLIC_KEY=pk_live_xxxxxxxxxxxxx`
   - `STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx`

3. **Create Live Products**
   - Toggle to "Live mode" in Stripe Dashboard
   - Repeat Step 1 to create products in live mode
   - Update Price IDs with live Price IDs

4. **Update Webhook**
   - Create a new webhook endpoint in live mode
   - Use the same URL and events as test mode

## Troubleshooting

### Payment Not Processing
- Verify Stripe keys are correctly set
- Check browser console for errors
- Ensure Price IDs match your Stripe products

### Subscription Not Updating
- Check webhook is configured correctly
- View webhook logs in Stripe Dashboard
- Ensure webhook URL is publicly accessible

### Test Payments Failing
- Make sure you're using test card: 4242 4242 4242 4242
- Verify you're in test mode (keys start with pk_test_/sk_test_)
- Check for declined test card scenarios: https://stripe.com/docs/testing

## Additional Resources

- **Stripe Dashboard**: https://dashboard.stripe.com
- **Stripe Testing Docs**: https://stripe.com/docs/testing
- **Stripe Webhooks Guide**: https://stripe.com/docs/webhooks
- **Stripe Billing Docs**: https://stripe.com/docs/billing

## Support

If you encounter issues:
1. Check Stripe Dashboard logs for detailed error messages
2. Review webhook event logs for subscription updates
3. Contact Stripe support if payment processing fails
