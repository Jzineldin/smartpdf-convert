# Environment Variables Guide

This document explains all environment variables needed for SmartPDF Convert.

## Quick Setup

1. Create a `.env` file in the project root (same folder as `package.json`)
2. Copy the template below
3. Fill in your actual values
4. Save and restart the development server

## Environment Variables Template

```env
# ============================================
# DATABASE (PostgreSQL/Supabase) - REQUIRED
# ============================================
# Format: postgresql://username:password@host:port/database_name?sslmode=require
# Example: postgresql://postgres:mypassword@db.xxxxx.supabase.co:5432/postgres?sslmode=require
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres?sslmode=require

# ============================================
# SUPABASE AUTH - REQUIRED (for authentication)
# Get these from https://supabase.com
# ============================================
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# ============================================
# JWT & OAUTH - REQUIRED
# ============================================
# Generate a random string at least 32 characters long
JWT_SECRET=your-secret-key-min-32-chars-long-enough-here
VITE_OAUTH_PORTAL_URL=https://api.manus.im
OWNER_OPEN_ID=your-owner-id
OWNER_NAME=Your Name

# ============================================
# AI/LLM (OpenRouter) - REQUIRED
# Get API key from https://openrouter.ai
# ============================================
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# ============================================
# STRIPE PAYMENTS - REQUIRED
# Get keys from https://stripe.com
# ============================================
STRIPE_SECRET_KEY=sk_live_your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=pk_live_your-stripe-publishable-key
STRIPE_PRO_PRICE_ID=price_1SfTwqGwHa557mvPhCaAtOE7
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-signing-secret

# ============================================
# AWS S3 (File Storage) - OPTIONAL
# Get credentials from AWS Console
# ============================================
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name

# ============================================
# MANUS PLATFORM - OPTIONAL (if using Manus hosting)
# ============================================
VITE_APP_ID=your-app-id
VITE_APP_TITLE=SmartPDF Convert
VITE_APP_LOGO=your-logo-url
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your-forge-api-key
VITE_FRONTEND_FORGE_API_KEY=your-frontend-forge-api-key
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im
VITE_ANALYTICS_ENDPOINT=your-analytics-endpoint
VITE_ANALYTICS_WEBSITE_ID=your-analytics-website-id

# ============================================
# DEVELOPMENT - OPTIONAL
# ============================================
# Set to false for production
TESTING_MODE=false
```

## Detailed Variable Explanations

### DATABASE_URL
**Required**: Yes
**Type**: Connection string
**Format**: `postgresql://username:password@host:port/database_name?sslmode=require`
**Example**: `postgresql://postgres:mypassword@db.xxxxx.supabase.co:5432/postgres?sslmode=require`
**Description**: PostgreSQL database connection string. Uses Supabase's built-in PostgreSQL database. Get from Supabase Dashboard → Settings → Database → Connection string.

### VITE_SUPABASE_URL
**Required**: Yes
**Type**: URL
**Example**: `https://your-project.supabase.co`
**Description**: Your Supabase project URL. Get from Supabase Dashboard → Settings → API.

### VITE_SUPABASE_ANON_KEY
**Required**: Yes
**Type**: API Key
**Description**: Supabase anonymous key for client-side authentication. Get from Supabase Dashboard → Settings → API.

### SUPABASE_SERVICE_ROLE_KEY
**Required**: Yes
**Type**: API Key
**Description**: Supabase service role key for server-side operations. Get from Supabase Dashboard → Settings → API.

### JWT_SECRET
**Required**: Yes
**Type**: Random string
**Min Length**: 32 characters
**Description**: Secret key for signing JWT tokens. Generate a random string of at least 32 characters.
**Generate**: Use `openssl rand -base64 32` or any random string generator.

### VITE_OAUTH_PORTAL_URL
**Required**: Yes
**Type**: URL
**Default**: `https://api.manus.im`
**Description**: OAuth portal URL for authentication flow.

### OWNER_OPEN_ID
**Required**: Yes
**Type**: String
**Description**: Your unique ID from the OAuth provider. Used to identify the app owner.

### OWNER_NAME
**Required**: Yes
**Type**: String
**Description**: Your name or company name.

### OPENROUTER_API_KEY
**Required**: Yes
**Type**: API Key
**Format**: `sk-or-v1-xxxxx`
**Description**: OpenRouter API key for GPT-4 Vision access. Get from https://openrouter.ai.

### STRIPE_SECRET_KEY
**Required**: Yes
**Type**: API Key
**Format**: `sk_live_xxxxx` (production) or `sk_test_xxxxx` (testing)
**Description**: Stripe secret key for payment processing. Get from Stripe Dashboard → Developers → API Keys.

### STRIPE_PUBLISHABLE_KEY
**Required**: Yes
**Type**: API Key
**Format**: `pk_live_xxxxx` (production) or `pk_test_xxxxx` (testing)
**Description**: Stripe publishable key for client-side payment forms. Get from Stripe Dashboard → Developers → API Keys.

### STRIPE_PRO_PRICE_ID
**Required**: Yes
**Type**: Stripe Price ID
**Default**: `price_1SfTwqGwHa557mvPhCaAtOE7`
**Description**: Stripe price ID for the Pro plan ($29/month). Create in Stripe Dashboard → Products.

### STRIPE_WEBHOOK_SECRET
**Required**: Yes (for production)
**Type**: Webhook Signing Secret
**Format**: `whsec_xxxxx`
**Description**: Stripe webhook signing secret for verifying webhook events. Get from Stripe Dashboard → Developers → Webhooks → Your endpoint → Signing secret.

### AWS_ACCESS_KEY_ID
**Required**: No (optional)
**Type**: AWS Access Key
**Description**: AWS access key for S3 file storage. Get from AWS IAM Console.

### AWS_SECRET_ACCESS_KEY
**Required**: No (optional)
**Type**: AWS Secret Key
**Description**: AWS secret key for S3 file storage. Get from AWS IAM Console.

### AWS_REGION
**Required**: No (optional)
**Type**: AWS Region
**Default**: `us-east-1`
**Description**: AWS region where your S3 bucket is located.

### AWS_S3_BUCKET
**Required**: No (optional)
**Type**: Bucket name
**Description**: Name of your S3 bucket for file storage. Create in AWS S3 Console.

### VITE_APP_ID
**Required**: No (optional for Manus)
**Type**: String
**Description**: Application ID for Manus platform integration.

### VITE_APP_TITLE
**Required**: No (optional for Manus)
**Type**: String
**Default**: `SmartPDF Convert`
**Description**: Application title displayed in Manus dashboard.

### VITE_APP_LOGO
**Required**: No (optional for Manus)
**Type**: URL
**Description**: Application logo URL for Manus dashboard.

### BUILT_IN_FORGE_API_URL
**Required**: No (optional for Manus)
**Type**: URL
**Default**: `https://api.manus.im`
**Description**: Manus Forge API endpoint.

### BUILT_IN_FORGE_API_KEY
**Required**: No (optional for Manus)
**Type**: API Key
**Description**: Manus Forge API key for backend operations.

### VITE_FRONTEND_FORGE_API_KEY
**Required**: No (optional for Manus)
**Type**: API Key
**Description**: Manus Forge API key for frontend operations.

### VITE_FRONTEND_FORGE_API_URL
**Required**: No (optional for Manus)
**Type**: URL
**Default**: `https://api.manus.im`
**Description**: Manus Forge API endpoint for frontend.

### VITE_ANALYTICS_ENDPOINT
**Required**: No (optional)
**Type**: URL
**Description**: Analytics service endpoint (e.g., Umami).

### VITE_ANALYTICS_WEBSITE_ID
**Required**: No (optional)
**Type**: String
**Description**: Analytics website ID for tracking.

### TESTING_MODE
**Required**: No (optional)
**Type**: Boolean (`true` or `false`)
**Default**: `false`
**Description**: When `true`, allows testing without authentication or payment. **Must be `false` for production.**

---

## How to Get Each Value

### Supabase (Database + Auth)
1. Go to https://supabase.com
2. Create a new project
3. Go to Settings → Database → Connection string (URI) → Copy → `DATABASE_URL`
4. Go to Settings → API
5. Copy `Project URL` → `VITE_SUPABASE_URL`
6. Copy `anon public` key → `VITE_SUPABASE_ANON_KEY`
7. Copy `service_role secret` key → `SUPABASE_SERVICE_ROLE_KEY`

### OpenRouter (AI)
1. Go to https://openrouter.ai
2. Sign up and log in
3. Go to Keys
4. Create new API key
5. Copy → `OPENROUTER_API_KEY`

### Stripe (Payments)
1. Go to https://stripe.com
2. Create account
3. Go to Developers → API Keys
4. Copy `Secret key` → `STRIPE_SECRET_KEY`
5. Copy `Publishable key` → `STRIPE_PUBLISHABLE_KEY`
6. Create a Product with pricing
7. Copy Price ID → `STRIPE_PRO_PRICE_ID`
8. Go to Developers → Webhooks → Add endpoint
9. Configure webhook URL: `https://your-domain.com/api/webhooks/stripe`
10. Copy Signing secret → `STRIPE_WEBHOOK_SECRET`

### AWS S3 (File Storage) - Optional
1. Go to https://aws.amazon.com
2. Create account
3. Go to S3 → Create bucket
4. Copy bucket name → `AWS_S3_BUCKET`
5. Go to IAM → Users → Create user
6. Attach S3 policy
7. Create access key
8. Copy Access Key ID → `AWS_ACCESS_KEY_ID`
9. Copy Secret Access Key → `AWS_SECRET_ACCESS_KEY`

---

## Validation

After creating `.env`, verify all required variables are set:

```bash
# Check if .env exists
ls -la .env

# Check if all required variables are present
grep "DATABASE_URL\|VITE_SUPABASE_URL\|JWT_SECRET\|OPENROUTER_API_KEY\|STRIPE_SECRET_KEY" .env
```

All should return values (not empty).

---

## Security Notes

⚠️ **IMPORTANT**:
- Never commit `.env` to Git (it's in `.gitignore`)
- Never share your `.env` file with others
- Never post your API keys in public forums
- Rotate keys regularly
- Use different keys for development and production
- Use `sk_test_` and `pk_test_` Stripe keys for development
- Use `sk_live_` and `pk_live_` Stripe keys for production

---

## Troubleshooting

### "DATABASE_URL is required"
- Check `.env` file exists in project root
- Verify `DATABASE_URL` is set
- Verify PostgreSQL connection string format is correct

### "Cannot connect to database"
- Check `DATABASE_URL` is correct
- Verify Supabase project is active
- Check if `?sslmode=require` is included in URL
- Verify password doesn't have unescaped special characters

### "Cannot connect to Supabase"
- Check `VITE_SUPABASE_URL` is correct
- Check `VITE_SUPABASE_ANON_KEY` is correct
- Verify Supabase project is active

### "OpenRouter API error"
- Check `OPENROUTER_API_KEY` is correct
- Verify API key has sufficient credits
- Check API key is not expired

### "Stripe error"
- Check `STRIPE_SECRET_KEY` is correct
- Check `STRIPE_PUBLISHABLE_KEY` is correct
- Verify `STRIPE_PRO_PRICE_ID` exists in your Stripe account

### "Webhook verification failed"
- Check `STRIPE_WEBHOOK_SECRET` is correct
- Verify webhook endpoint URL is correct in Stripe dashboard
- Check webhook events are enabled

### "S3 access denied"
- Check AWS credentials are correct
- Verify IAM user has S3 permissions
- Check bucket name is correct
- Verify bucket region matches `AWS_REGION`

---

**Last Updated**: December 18, 2024
