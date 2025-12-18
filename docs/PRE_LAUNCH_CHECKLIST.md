# SmartPDF Convert - Pre-Launch Checklist

This document contains EVERYTHING that needs to be done before publishing the application.

---

## 🔴 CRITICAL - Must Do Before Launch

### 1. Disable Testing Mode
**Status**: ❌ NOT DONE  
**Priority**: CRITICAL  
**Files to change**:
- `server/routers.ts` - Line with `const TESTING_MODE = true;` → Change to `false`
- `client/src/components/templates/TemplateSelector.tsx` - Line with `const TESTING_MODE = true;` → Change to `false`

**What this does**: When `TESTING_MODE = true`, Pro features work without subscription. Must be `false` for production.

---

### 2. Configure Stripe Webhook
**Status**: ❌ NOT DONE  
**Priority**: CRITICAL  

**Steps**:
1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Enter endpoint URL: `https://your-domain.com/api/webhooks/stripe`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the "Signing secret" (starts with `whsec_`)
6. Add to environment variables: `STRIPE_WEBHOOK_SECRET=whsec_xxxxx`

**Without this**: Subscriptions won't update in database after payment.

---

### 3. Add Missing Environment Variable
**Status**: ❌ NOT DONE  
**Priority**: CRITICAL  

Add `STRIPE_WEBHOOK_SECRET` to your environment:
```env
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret
```

**Note**: This is NOT in the current ENV_VARIABLES.md - needs to be added.

---

### 4. Verify Stripe Price ID
**Status**: ⚠️ NEEDS VERIFICATION  
**Priority**: CRITICAL  

Current Price ID: `price_1SfTwqGwHa557mvPhCaAtOE7`

**Verify**:
1. Go to Stripe Dashboard → Products
2. Find your Pro plan product
3. Verify the Price ID matches
4. Verify price is $29/month as shown on landing page

---

### 5. Test Payment Flow End-to-End
**Status**: ❌ NOT DONE  
**Priority**: CRITICAL  

**Test checklist**:
- [ ] Create new account
- [ ] Use free tier (3 conversions)
- [ ] Hit free tier limit
- [ ] Click upgrade to Pro
- [ ] Complete Stripe checkout (use test card 4242 4242 4242 4242)
- [ ] Verify subscription status updates in database
- [ ] Verify Pro features unlock
- [ ] Test subscription cancellation via Stripe portal
- [ ] Verify cancellation updates database

---

## 🟡 IMPORTANT - Should Do Before Launch

### 6. Remove/Reduce Console Logs
**Status**: ❌ NOT DONE  
**Priority**: HIGH  

Currently 23 `console.log` statements in codebase. Review and remove unnecessary ones:
- Keep error logs (`console.error`)
- Keep important server logs
- Remove debug/development logs

**Command to find them**:
```bash
grep -r "console.log" --include="*.ts" --include="*.tsx" server/ client/src/
```

---

### 7. Update Canonical URL
**Status**: ❌ NOT DONE  
**Priority**: HIGH  

**File**: `client/index.html`

Current: `<link rel="canonical" href="https://smartpdfapp-kv8psphs.manus.space/" />`

**Change to**: Your actual production domain when you have it.

---

### 8. Update JSON-LD Schema URLs
**Status**: ❌ NOT DONE  
**Priority**: HIGH  

**File**: `client/index.html`

Update all URLs in structured data schemas:
- Organization schema `url`
- SoftwareApplication schema `url`
- HowTo schema images

**Change from**: `https://smartpdfapp-kv8psphs.manus.space`  
**Change to**: Your production domain

---

### 9. Add Real Logo Images
**Status**: ❌ NOT DONE  
**Priority**: HIGH  

**Files needed**:
- `/client/public/logo.png` - Main logo
- `/client/public/step-1.png` - HowTo schema step 1 image
- `/client/public/step-2.png` - HowTo schema step 2 image
- `/client/public/step-3.png` - HowTo schema step 3 image
- `/client/public/favicon.ico` - Browser favicon

---

### 10. Configure Google OAuth (Optional but Recommended)
**Status**: ⚠️ PARTIALLY DONE  
**Priority**: MEDIUM-HIGH  

**Steps**:
1. Go to Google Cloud Console
2. Create OAuth 2.0 credentials
3. Add authorized redirect URIs
4. Configure in Supabase Dashboard → Authentication → Providers → Google
5. Test Google sign-in flow

---

### 11. Set Up Error Monitoring
**Status**: ❌ NOT DONE  
**Priority**: MEDIUM  

**Options**:
- Sentry (recommended)
- LogRocket
- Bugsnag

**Benefits**: Catch errors in production before users report them.

---

### 12. Set Up Analytics
**Status**: ⚠️ PARTIALLY CONFIGURED  
**Priority**: MEDIUM  

Environment variables exist for Umami analytics:
- `VITE_ANALYTICS_ENDPOINT`
- `VITE_ANALYTICS_WEBSITE_ID`

**Verify**:
- [ ] Umami is set up
- [ ] Website ID is correct
- [ ] Analytics script loads on all pages
- [ ] Events are being tracked

---

## 🟢 NICE TO HAVE - Can Do After Launch

### 13. Add Rate Limiting
**Status**: ❌ NOT DONE  
**Priority**: LOW  

Add rate limiting to prevent API abuse:
- Limit requests per IP
- Limit requests per user
- Protect against DDoS

**Libraries**: `express-rate-limit`, `rate-limiter-flexible`

---

### 14. Add CAPTCHA for Anonymous Users
**Status**: ❌ NOT DONE  
**Priority**: LOW  

Prevent bot abuse of free tier:
- Add reCAPTCHA or hCaptcha
- Only for anonymous (non-logged-in) users

---

### 15. Add Email Notifications
**Status**: ❌ NOT DONE  
**Priority**: LOW  

Send emails for:
- Welcome email after signup
- Subscription confirmation
- Subscription cancellation
- Usage limit warnings

---

### 16. Add Terms of Service & Privacy Policy
**Status**: ❌ NOT DONE  
**Priority**: MEDIUM (legally important)  

Create pages:
- `/terms` - Terms of Service
- `/privacy` - Privacy Policy

**Include**:
- Data handling practices
- File retention policy (7 days)
- Third-party services used (OpenRouter, Stripe, AWS)
- User rights

---

### 17. Add Cookie Consent Banner
**Status**: ❌ NOT DONE  
**Priority**: MEDIUM (legally required in EU)  

Required for GDPR compliance if serving EU users.

---

### 18. Performance Optimization
**Status**: ❌ NOT DONE  
**Priority**: LOW  

- [ ] Enable gzip compression
- [ ] Add caching headers
- [ ] Optimize images
- [ ] Lazy load components
- [ ] Code splitting

---

### 19. Security Audit
**Status**: ❌ NOT DONE  
**Priority**: MEDIUM  

- [ ] Review all API endpoints for auth
- [ ] Check for SQL injection vulnerabilities
- [ ] Verify file upload validation
- [ ] Check CORS configuration
- [ ] Review environment variable exposure

---

### 20. Backup Strategy
**Status**: ❌ NOT DONE  
**Priority**: MEDIUM  

- [ ] Set up database backups
- [ ] Configure S3 versioning
- [ ] Document recovery procedures

---

## 📋 QUICK REFERENCE - Launch Day Checklist

```
□ TESTING_MODE = false (2 files)
□ Stripe webhook configured
□ STRIPE_WEBHOOK_SECRET added to env
□ Stripe Price ID verified
□ Payment flow tested end-to-end
□ Console logs cleaned up
□ Canonical URL updated
□ JSON-LD URLs updated
□ Logo images added
□ Google OAuth tested (if using)
□ Analytics verified
□ Terms & Privacy pages added
□ Final test of all features
□ Database backup taken
□ Publish!
```

---

## 🔧 FILES TO MODIFY BEFORE LAUNCH

| File | Change Required |
|------|-----------------|
| `server/routers.ts` | Set `TESTING_MODE = false` |
| `client/src/components/templates/TemplateSelector.tsx` | Set `TESTING_MODE = false` |
| `client/index.html` | Update canonical URL and JSON-LD URLs |
| `.env` (production) | Add `STRIPE_WEBHOOK_SECRET` |
| `ENV_VARIABLES.md` | Document `STRIPE_WEBHOOK_SECRET` |

---

## 🧪 TESTING CHECKLIST

### Free Tier Testing
- [ ] Anonymous user can upload PDF/image
- [ ] Anonymous user limited to 3/day
- [ ] Logged-in free user limited to 3/day
- [ ] Counter resets at midnight
- [ ] Upgrade prompt shows when limit reached

### Pro Tier Testing
- [ ] Pro user has unlimited conversions
- [ ] Pro user can access all templates
- [ ] Pro user sees confidence scores
- [ ] Subscription status shows correctly
- [ ] Can manage subscription via Stripe portal

### Conversion Testing
- [ ] Single-page PDF converts correctly
- [ ] Multi-page PDF (2-10 pages) converts correctly
- [ ] PNG/JPG images convert correctly
- [ ] Large files (near 20MB) work
- [ ] Invalid files show proper error
- [ ] Excel export works correctly
- [ ] Copy to clipboard works

### Template Testing
- [ ] Invoice template extracts correctly
- [ ] Bank Statement template extracts correctly
- [ ] Expense Report template extracts correctly
- [ ] Inventory template extracts correctly
- [ ] Sales Report template extracts correctly
- [ ] General template extracts correctly

### UI Testing
- [ ] Landing page loads correctly
- [ ] All navigation links work
- [ ] Mobile responsive design works
- [ ] Dark/light theme toggle works
- [ ] Error states display properly
- [ ] Loading states display properly

---

## 📊 CURRENT STATUS SUMMARY

| Category | Done | Remaining |
|----------|------|-----------|
| Critical | 0/5 | 5 |
| Important | 0/7 | 7 |
| Nice to Have | 0/8 | 8 |
| **Total** | **0/20** | **20** |

**Minimum for launch**: Complete all CRITICAL items (5 tasks)
**Recommended for launch**: Complete CRITICAL + IMPORTANT items (12 tasks)

---

## 🚀 ESTIMATED TIME TO LAUNCH

| Task Category | Estimated Time |
|---------------|----------------|
| Critical tasks | 2-3 hours |
| Important tasks | 3-4 hours |
| Nice to have | 4-6 hours |
| **Total (all)** | **9-13 hours** |

**Minimum viable launch**: ~2-3 hours (critical only)

---

**Last Updated**: December 18, 2024
**Document Version**: 1.0
