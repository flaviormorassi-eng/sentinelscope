# Stripe Subscription Setup (Platform-agnostic)

Configures products, prices, webhooks, and env variables for SentinelScope subscription billing.

## 1. Create Products & Prices

In Stripe Dashboard (Test mode first):

| Plan | Name | Monthly Price | Notes |
|------|------|---------------|-------|
| Individual | SentinelScope Individual | 5.00 USD | Up to 3 devices |
| Small Business | SentinelScope Small Business | 49.99 USD | Up to 30 devices |
| Pro | SentinelScope Pro | 199.99 USD | Up to 100 devices |

Steps:
1. Products → Add product
2. Set Name, Description, Recurring monthly price
3. Save and copy the Price ID (`price_...`)
4. Repeat for all tiers

## 2. Configure Price IDs

Preferred: set in `.env` (never hardcode in production):
```
STRIPE_PRICE_INDIVIDUAL=price_xxxxxxxxx
STRIPE_PRICE_SMB=price_xxxxxxxxx
STRIPE_PRICE_ENTERPRISE=price_xxxxxxxxx
```

Fallback for quick testing: update `SUBSCRIPTION_TIERS` in `shared/schema.ts` with the `stripePriceId` fields.

## 3. Environment Variables

Server:
```
STRIPE_SECRET_KEY=sk_test_xxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxx   # optional but recommended
```
Client (Vite):
```
VITE_STRIPE_PUBLIC_KEY=pk_test_xxxxxxxxx
```

## 4. Webhook Setup

Stripe Dashboard → Developers → Webhooks → Add endpoint:
```
Endpoint URL: https://YOUR_DOMAIN/api/stripe/webhook
Events: 
  customer.subscription.created
  customer.subscription.updated
  customer.subscription.deleted
  invoice.payment_succeeded
  invoice.payment_failed
```
Reveal signing secret → set `STRIPE_WEBHOOK_SECRET` in `.env`.

Local testing:
```bash
stripe listen --forward-to http://localhost:3001/api/stripe/webhook
```

## 5. Test Flow

1. Start app: `npm run dev`
2. Go to Subscription page
3. Choose plan → Checkout session opens
4. Use test card `4242 4242 4242 4242` (any future exp, any CVC)
5. After success, verify subscription active in Stripe Dashboard → Subscriptions
6. Confirm user record updated (Stripe customer & subscription IDs).

## 6. Going Live

1. Switch Dashboard to Live mode
2. Recreate products, gather live Price IDs
3. Replace test keys with live keys in `.env`
4. Add live webhook endpoint & signing secret
5. Ensure `PUBLIC_BASE_URL` points to production domain

## 7. Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| "No client secret" | Missing Price IDs | Set env or update schema |
| 400 from webhook | Wrong signing secret | Re-copy `whsec_...` value |
| Payment form not loading | Bad publishable key | Verify `VITE_STRIPE_PUBLIC_KEY` starts with `pk_test_` or `pk_live_` |
| Subscription not updating | Webhook not configured or failing | Check Stripe webhook logs & server logs |
| Declines during test | Wrong test card or forced failure card | Use valid test card list from Stripe docs |

## 8. Useful Test Cards

| Scenario | Number |
|----------|--------|
| Standard success | 4242 4242 4242 4242 |
| Generic decline | 4000 0000 0000 0002 |
| Insufficient funds | 4000 0000 0000 9995 |
| Expired card | 4000 0000 0000 0069 |
| Incorrect CVC | 4000 0000 0000 0127 |

## 9. Checklist

- [ ] Products created with correct pricing
- [ ] Price IDs stored (env)
- [ ] Keys in `.env` (secret & publishable)
- [ ] Webhook endpoint added & secret stored
- [ ] Test payment succeeds
- [ ] Subscription active & stored in user record
- [ ] Billing portal accessible
- [ ] Webhook events processed
- [ ] Live mode prepared (final step only when ready)

## 10. References

- Stripe Docs: https://stripe.com/docs
- Testing Cards: https://stripe.com/docs/testing
- Webhooks: https://stripe.com/docs/webhooks
- Billing Portal: https://stripe.com/docs/billing/subscriptions/integrating-customer-portal
