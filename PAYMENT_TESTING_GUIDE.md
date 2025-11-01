# 💳 Stripe Payment Testing Guide - SentinelScope

This guide provides step-by-step instructions to test the complete Stripe payment integration in SentinelScope.

---

## 📋 Prerequisites

Before you start testing, make sure you have:

✅ **Stripe Account** - Signed up at https://stripe.com  
✅ **Test Mode Enabled** - Using test keys (pk_test_ and sk_test_)  
✅ **Stripe Products Created** - Three subscription products configured (see STRIPE_SETUP.md)  
✅ **Environment Variables Set** - All Stripe keys configured in Replit Secrets

---

## 🔑 Step 1: Verify Stripe Configuration

### 1.1 Check Environment Variables

Make sure these are set in **Replit Secrets**:

```
VITE_STRIPE_PUBLIC_KEY=pk_test_xxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
```

### 1.2 Verify Stripe Products

1. Go to https://dashboard.stripe.com/test/products
2. Confirm you have 3 products:
   - **SentinelScope Individual** - $5.00/month
   - **SentinelScope Small Business** - $49.99/month
   - **SentinelScope Enterprise** - $199.99/month
3. Copy each Price ID (starts with `price_...`)

### 1.3 Configure Price IDs

**Option A: Environment Variables (Recommended)**
```
STRIPE_PRICE_INDIVIDUAL=price_xxxxxxxxxxxxx
STRIPE_PRICE_SMB=price_xxxxxxxxxxxxx
STRIPE_PRICE_ENTERPRISE=price_xxxxxxxxxxxxx
```

**Option B: Hardcode in Schema**
Edit `shared/schema.ts` and add Price IDs to SUBSCRIPTION_TIERS:
```typescript
export const SUBSCRIPTION_TIERS = {
  individual: {
    name: "Individual",
    price: 5,
    stripePriceId: "price_xxxxxxxxxxxxx",
    // ...
  },
  // ...
}
```

---

## 🧪 Step 2: Test Subscription Checkout Flow

### 2.1 Login to Application

1. **Open your application** in a browser
2. **Click "Sign In"**
3. **Login with Google** or your authentication method
4. You should be redirected to the Dashboard

### 2.2 Navigate to Subscription Page

1. Click **"Subscription"** in the sidebar
2. You should see three subscription plan cards:
   - Individual ($5/month)
   - Small Business ($49.99/month) - marked as "Most Popular"
   - Enterprise ($199.99/month)

### 2.3 Select a Plan

1. **Click "Choose Plan"** on any tier (we'll use Individual for testing)
2. You should be redirected to `/checkout?tier=individual`
3. The checkout page should show:
   - ✅ Plan name: "Individual"
   - ✅ Price: "$5/month"
   - ✅ Stripe payment form (card details)
   - ✅ List of included features
   - ✅ "Pay $5" button
   - ✅ "Cancel" button

### 2.4 Complete Payment with Test Card

**Use Stripe's Test Card:**

```
Card Number:  4242 4242 4242 4242
Expiry Date:  12/25 (any future date)
CVC:          123 (any 3 digits)
ZIP Code:     12345 (any ZIP)
```

**Steps:**
1. Enter the test card details in the Stripe payment form
2. Click **"Pay $5"**
3. Wait for processing (you should see "Processing..." on the button)
4. You should be redirected back to `/subscription?success=true`
5. You should see a success toast: **"Payment Successful! Your subscription is now active."**

### 2.5 Verify Subscription Activation

After successful payment, verify:

1. ✅ Green alert banner appears: "You have an active subscription..."
2. ✅ "Manage Billing" button is visible
3. ✅ "Renews on" date is displayed
4. ✅ "Current Plan" button is disabled for Individual tier
5. ✅ Other tier buttons still show "Choose Plan"

---

## 🔄 Step 3: Test Billing Portal

### 3.1 Open Billing Portal

1. From the Subscription page, click **"Manage Billing"**
2. You should be redirected to Stripe's hosted billing portal
3. The portal URL should start with: `https://billing.stripe.com/...`

### 3.2 Verify Portal Features

In the Stripe Billing Portal, you should be able to:

- ✅ View subscription details
- ✅ Update payment method
- ✅ View invoice history
- ✅ Cancel subscription
- ✅ Update billing address

### 3.3 Test Payment Method Update

1. Click **"Update payment method"**
2. Enter new test card details:
   ```
   Card Number: 5555 5555 5555 4444 (Mastercard)
   Expiry: 12/26
   CVC: 456
   ```
3. Save the changes
4. Verify the payment method was updated

---

## ❌ Step 4: Test Subscription Cancellation

### 4.1 Cancel Subscription

1. In the Billing Portal, click **"Cancel plan"**
2. Select a cancellation reason
3. Confirm cancellation
4. You should see: **"Your subscription will be canceled at the end of the billing period"**

### 4.2 Verify Cancellation

1. Return to the SentinelScope app
2. Refresh the Subscription page
3. The subscription should still show as "active" until the period end date
4. After the period end date passes, status should change to "canceled"

**Note:** In test mode, you can verify this by checking your Stripe Dashboard:
- Go to https://dashboard.stripe.com/test/subscriptions
- Find your subscription
- Status should show "Active" with "Cancels on [date]"

---

## 🔔 Step 5: Test Webhook Events

### 5.1 Trigger Webhook Events

Stripe automatically sends webhooks for various events. You can test them:

**Method 1: Complete a payment (already done in Step 2)**
- This triggers: `invoice.payment_succeeded`

**Method 2: Simulate events in Stripe Dashboard**
1. Go to https://dashboard.stripe.com/test/webhooks
2. Click on your webhook endpoint
3. Click **"Send test webhook"**
4. Select event type:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

### 5.2 Verify Webhook Processing

Check your application logs to confirm webhooks were received:

```
[express] POST /api/stripe/webhook 200 in XXms
Webhook received: invoice.payment_succeeded
Subscription activated for user: vvY2qUBOu0Tt...
```

---

## 🧪 Step 6: Test Failed Payment

### 6.1 Use Declined Test Card

Stripe provides test cards that simulate declined payments:

```
Card Number:  4000 0000 0000 0002 (Generic decline)
Expiry Date:  12/25
CVC:          123
ZIP:          12345
```

**Steps:**
1. Go to Subscription page
2. Click "Choose Plan" on any tier
3. Enter the declined test card
4. Click "Pay"
5. You should see an error: **"Payment failed. Please check your card details and try again."**

### 6.2 Test Insufficient Funds

```
Card Number:  4000 0000 0000 9995 (Insufficient funds)
Expiry Date:  12/25
CVC:          123
```

Follow the same steps as above. You should see a specific error message.

---

## 🌍 Step 7: Test Bilingual Support

### 7.1 Switch to Portuguese

1. Click the language toggle (🌐 icon) in the header
2. Select **"Português"**
3. Navigate to Subscription page
4. Verify all text is translated:
   - Plan names
   - Buttons
   - Descriptions
   - Success/error messages

### 7.2 Test Checkout in Portuguese

1. Click **"Escolher Plano"**
2. Verify checkout page is in Portuguese:
   - "Complete sua Assinatura"
   - "Detalhes do Pagamento"
   - "Pagar $5"
   - "Cancelar"

---

## ✅ Step 8: Verify Database Updates

### 8.1 Check User Record

After successful payment, verify the database was updated:

1. Open Replit Database viewer
2. Find your user record
3. Verify these fields are populated:
   ```json
   {
     "stripeCustomerId": "cus_xxxxxxxxxxxxx",
     "stripeSubscriptionId": "sub_xxxxxxxxxxxxx",
     "stripePriceId": "price_xxxxxxxxxxxxx",
     "subscriptionStatus": "active",
     "currentPeriodEnd": "2025-12-01T00:00:00.000Z",
     "subscriptionTier": "individual"
   }
   ```

---

## 🐛 Troubleshooting

### Issue: "No client secret received"

**Cause:** Stripe Price IDs not configured  
**Solution:**
1. Check STRIPE_PRICE_INDIVIDUAL, STRIPE_PRICE_SMB, STRIPE_PRICE_ENTERPRISE in Replit Secrets
2. Or verify hardcoded Price IDs in shared/schema.ts

### Issue: "Stripe is not defined" or payment form doesn't load

**Cause:** Missing or invalid Stripe publishable key  
**Solution:**
1. Check VITE_STRIPE_PUBLIC_KEY in Replit Secrets
2. Ensure it starts with `pk_test_` for test mode
3. Restart the application

### Issue: Payment succeeds but subscription not activated

**Cause:** Webhook not configured or failing  
**Solution:**
1. Check webhook endpoint is configured: `https://your-app.replit.dev/api/stripe/webhook`
2. View webhook logs in Stripe Dashboard
3. Check application logs for webhook processing errors

### Issue: "Invalid API key"

**Cause:** Wrong Stripe secret key  
**Solution:**
1. Verify STRIPE_SECRET_KEY in Replit Secrets
2. Ensure it starts with `sk_test_` for test mode
3. Ensure no extra spaces or quotes

---

## 🎯 Testing Checklist

Use this checklist to ensure complete testing:

- [ ] Environment variables configured
- [ ] Stripe products created with correct prices
- [ ] Login to application successful
- [ ] Subscription page displays all three tiers
- [ ] Checkout page loads with Stripe Elements
- [ ] Test payment completes successfully
- [ ] Success toast appears after payment
- [ ] Subscription status shows "active"
- [ ] "Manage Billing" button works
- [ ] Billing portal opens correctly
- [ ] Payment method can be updated
- [ ] Subscription can be canceled
- [ ] Webhooks process correctly
- [ ] Failed payment shows error message
- [ ] Portuguese translation works
- [ ] Database fields updated correctly

---

## 📚 Additional Resources

- **Stripe Testing Cards:** https://stripe.com/docs/testing
- **Stripe Dashboard:** https://dashboard.stripe.com
- **Stripe Webhooks:** https://stripe.com/docs/webhooks
- **Stripe Billing Portal:** https://stripe.com/docs/billing/subscriptions/integrating-customer-portal

---

## 🎉 Success Criteria

Your payment integration is working correctly if:

1. ✅ Users can view subscription plans
2. ✅ Checkout redirects to Stripe payment form
3. ✅ Test payments complete successfully
4. ✅ Subscription activates after payment
5. ✅ Billing portal opens and allows management
6. ✅ Webhooks update subscription status
7. ✅ Failed payments show appropriate errors
8. ✅ Both English and Portuguese work correctly
9. ✅ Database reflects subscription changes

---

## 🆘 Need Help?

If you encounter issues:
1. Check application logs in Replit
2. Check Stripe Dashboard logs
3. Verify all environment variables
4. Review STRIPE_SETUP.md for configuration steps
5. Contact Stripe support for payment-specific issues

**Happy Testing! 🚀**
