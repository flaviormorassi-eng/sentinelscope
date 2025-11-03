# SentinelScope - Deployment & Safety Guide

## 📋 Table of Contents
1. [Publishing Your Application](#publishing-your-application)
2. [Making Changes After Publishing](#making-changes-after-publishing)
3. [Data Safety & Backups](#data-safety--backups)
4. [Rollback & Recovery](#rollback--recovery)
5. [Security Checklist](#security-checklist)

---

## 🚀 Publishing Your Application

### First Time Publishing

1. **Verify All Secrets Are Set**
   - Go to the "Secrets" tab in Replit
   - Ensure all required secrets are configured:
     - `DATABASE_URL` (automatically set by Replit)
     - `STRIPE_SECRET_KEY`
     - `VITE_STRIPE_PUBLIC_KEY`
     - `VIRUSTOTAL_API_KEY`
     - `VITE_FIREBASE_API_KEY`
     - `VITE_FIREBASE_PROJECT_ID`
     - `VITE_FIREBASE_APP_ID`
     - `SESSION_SECRET`

2. **Test Everything Locally**
   - Run the application: `npm run dev`
   - Test all major features:
     - Authentication (Google OAuth)
     - Dashboard and threat monitoring
     - VirusTotal scanning
     - Event source creation
     - Stripe subscription flow
     - Compliance dashboard (admin)
   - Check browser console for errors
   - Verify database connections work

3. **Click Publish**
   - Click the "Publish" button in Replit
   - Your app will be built and deployed
   - You'll receive a `.replit.app` domain

4. **Post-Publish Verification**
   - Visit your published URL
   - Test login functionality
   - Verify database connectivity
   - Check that all API endpoints work

---

## 🔄 Making Changes After Publishing

### Development Workflow

```
┌─────────────────────────────┐
│  1. Work in Development     │
│     (this workspace)        │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  2. Make Your Changes       │
│     - Edit code             │
│     - Add features          │
│     - Fix bugs              │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  3. Test Locally            │
│     npm run dev             │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  4. Publish Again           │
│     (creates new snapshot)  │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  5. Published App Updated   │
│     ✓ All changes deployed  │
└─────────────────────────────┘
```

### What Happens When You Republish?

**✅ Persisted (Safe):**
- All PostgreSQL database data
  - Users, threats, alerts
  - Event sources, audit logs
  - Subscription data, preferences
- Environment variables (Secrets)
- Custom domain configuration

**⚠️ NOT Persisted:**
- Files written to filesystem (we don't use this)
- In-memory cache (resets on deployment)

**💡 Key Point:** Since SentinelScope stores everything in PostgreSQL, **you won't lose any data when you republish**!

---

## 🛡️ Data Safety & Backups

### Automatic Protections

1. **PostgreSQL Hosted on Neon**
   - Professional-grade database hosting
   - Automatic daily backups
   - Point-in-time restore available
   - 7-day retention for deleted databases

2. **Checkpoint System**
   - Replit automatically creates checkpoints during development
   - Captures complete project state including database
   - Allows one-click restoration

### Database Backup Configuration

**Enable Point-in-Time Restore:**

1. Go to the **Database** tool in your Replit workspace
2. Click the **Settings** tab
3. In the **History Retention** section:
   - Set retention period (recommended: 7 days or more)
   - This enables point-in-time restore functionality

**Manual Database Export (Optional):**

For extra safety, you can periodically export your data:

```bash
# Export all data as JSON via API
curl -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
     https://your-app.replit.app/api/compliance/data-export > backup.json
```

### Development vs. Production Database

**Important Distinction:**

- **Development Database**: What you're working with now
  - Safe to experiment
  - Changes can be tested freely
  
- **Production Database**: Created when you publish
  - Contains real user data
  - Schema changes from dev are applied on publish
  - Data is preserved between publishes

---

## ⏮️ Rollback & Recovery

### Rollback to Previous Checkpoint

If something goes wrong, you can restore to any previous checkpoint:

1. **Access Rollback:**
   - Look for checkpoint history in your Replit workspace
   - You'll see a list of automatic checkpoints with timestamps

2. **Choose Rollback Options:**
   - **Code only**: Restores files and packages
   - **Code + Database**: Restores everything to that point in time

3. **Confirm Rollback:**
   - Click to restore
   - Your workspace returns to that checkpoint state

**⚠️ Warning:** Database point-in-time restore **cannot be undone** or rolled forward. Always verify before confirming.

### Point-in-Time Database Restore

If you need to restore just the database to a specific time:

1. Go to **Database** tool → **Settings** tab
2. Find the **Restore** section
3. Select a timestamp within your retention period
4. Confirm restoration

**Use Cases:**
- Accidental data deletion
- Database corruption
- Testing/debugging a past state
- Recovering from a bad migration

### Recovery Checklist

If you encounter issues after publishing:

- [ ] Check workflow logs for errors
- [ ] Verify all environment secrets are set
- [ ] Test database connection
- [ ] Check Firebase authentication configuration
- [ ] Verify Stripe webhook endpoints
- [ ] Review recent code changes
- [ ] Consider rollback if needed

---

## 🔒 Security Checklist

### Before Publishing

- [ ] **All API keys are in Replit Secrets** (never in code)
- [ ] **SESSION_SECRET is set** (for session encryption)
- [ ] **Firebase OAuth is properly configured**
- [ ] **Stripe webhook endpoint is correct**
- [ ] **VirusTotal API key is valid**
- [ ] **Database uses SSL connections** (automatic with Neon)

### After Publishing

- [ ] **Test authentication flow** (Google OAuth)
- [ ] **Verify HTTPS is enforced** (automatic on .replit.app)
- [ ] **Test Stripe payment flow** in test mode first
- [ ] **Check CORS settings** if using custom domain
- [ ] **Monitor security audit logs** (`/admin/compliance`)

### Ongoing Security

- [ ] **Review audit logs regularly** (Compliance Dashboard)
- [ ] **Monitor failed login attempts**
- [ ] **Check for unusual API activity**
- [ ] **Keep dependencies updated** (run `npm outdated`)
- [ ] **Enable database point-in-time restore**
- [ ] **Set up alerts for critical events**

---

## 📊 Monitoring After Deployment

### Health Checks

**Check Application Status:**
1. Visit your published URL
2. Monitor Dashboard for active threats
3. Check Event Sources are receiving data
4. Verify VirusTotal integration works

**Check Database Health:**
1. Admin Dashboard → System Analytics
2. Monitor user growth
3. Check threat detection rates
4. Review audit log activity

**Check Stripe Integration:**
1. Test subscription flow
2. Verify webhook events are received
3. Check subscription status updates

### Performance Monitoring

**Things to Watch:**
- API response times (especially `/api/stats`)
- Database query performance
- Memory usage
- Event ingestion rate

**Tools:**
- Replit workflow logs
- Browser console (Network tab)
- Admin Compliance Dashboard
- Stripe Dashboard (for payment metrics)

---

## 🆘 Troubleshooting Common Issues

### Issue: Database Connection Errors

**Solution:**
```bash
# Check if DATABASE_URL is set
echo $DATABASE_URL

# Verify database is accessible
npm run db:push
```

### Issue: Authentication Fails After Publishing

**Solution:**
1. Check Firebase Console
2. Add published domain to authorized domains:
   - `your-app.replit.app`
   - Add as authorized redirect URI
3. Verify environment variables are set

### Issue: Stripe Webhooks Not Working

**Solution:**
1. Go to Stripe Dashboard → Webhooks
2. Update endpoint URL to published domain:
   - `https://your-app.replit.app/api/stripe/webhook`
3. Verify webhook signing secret matches

### Issue: Need to Revert Changes

**Solution:**
Use Replit's checkpoint system:
1. Find the last working checkpoint
2. Choose "Restore databases" option
3. Confirm rollback
4. Test thoroughly before republishing

---

## 📝 Best Practices

### Do's ✅

- **Test locally before publishing**
- **Enable database point-in-time restore**
- **Monitor audit logs regularly**
- **Keep secrets in Replit Secrets**
- **Document any custom configurations**
- **Test payment flows in Stripe test mode**
- **Review compliance reports monthly**

### Don'ts ❌

- **Don't commit secrets to code**
- **Don't skip local testing**
- **Don't delete checkpoints immediately**
- **Don't modify production database directly**
- **Don't disable audit logging**
- **Don't share API keys publicly**

---

## 🎯 Summary

**Your Data is Safe When:**
- Using PostgreSQL for all persistent data ✅
- Secrets are in Replit Secrets ✅
- Point-in-time restore is enabled ✅
- Checkpoints are available ✅
- Regular monitoring is in place ✅

**How to Update Published App:**
1. Make changes in workspace
2. Test with `npm run dev`
3. Click "Publish" again
4. All data persists automatically!

**Emergency Recovery:**
- Use Replit checkpoints for full restore
- Use point-in-time restore for database only
- Check audit logs for security incidents
- Contact support if database was deleted (7-day retention)

---

## 📞 Support Resources

- **Replit Documentation**: https://docs.replit.com
- **PostgreSQL/Neon**: Database tool → Settings
- **Stripe Support**: dashboard.stripe.com
- **Firebase Console**: console.firebase.google.com
- **VirusTotal API**: developers.virustotal.com

---

**Remember**: With proper backups and the checkpoint system, your SentinelScope deployment is safe and recoverable! 🛡️
