# SmartPDF Convert

AI-powered SaaS application that extracts invoice data, bank statements, and tables from PDF documents and converts them to editable Excel spreadsheets.

## Features

- **AI-Powered Extraction** - Uses GPT-4 Vision to extract data with 90-99% accuracy
- **Multi-Page PDF Support** - Process up to 10 pages per document
- **Real-Time Spreadsheet Editor** - Review and edit extracted data before export
- **Excel Export** - Download results as clean .xlsx files
- **Multiple Templates** - Invoice, Bank Statement, Expense Report, Inventory, Sales Report
- **Confidence Scoring** - Visual indicators showing extraction quality
- **User Authentication** - Email/password and Google OAuth via Supabase
- **Stripe Payments** - Pro plan ($29/month) for unlimited conversions
- **Usage Tracking** - Free tier: 3 conversions/day, Pro: 100/month

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS 4, Vite
- **Backend**: Express 4, tRPC 11, Node.js
- **Database**: MySQL with Drizzle ORM
- **Authentication**: Supabase Auth (email/password + Google OAuth)
- **AI**: GPT-4 Vision via OpenRouter API
- **Payments**: Stripe (Live mode)
- **PDF Processing**: pdf-lib (page detection), pdf2pic + GraphicsMagick (conversion)
- **Spreadsheet**: FortuneSheet (editor), ExcelJS (export)

## Prerequisites

Before you start, make sure you have:

- **Node.js**: v18+ (check with `node --version`)
- **pnpm**: v10+ (install with `npm install -g pnpm`)
- **Git**: For cloning the repository

## Environment Variables

Create a `.env` file in the root directory with these variables:

```env
# Database (MySQL)
DATABASE_URL=mysql://username:password@host:3306/database_name

# Supabase Auth (for authentication only)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Authentication
JWT_SECRET=your_jwt_secret_key
VITE_OAUTH_PORTAL_URL=https://api.manus.im

# AI/LLM
OPENROUTER_API_KEY=your_openrouter_api_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_PRO_PRICE_ID=price_1SfTwqGwHa557mvPhCaAtOE7

# AWS S3 (for file storage)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your_s3_bucket_name

# Manus (if using Manus platform)
VITE_APP_ID=your_app_id
VITE_APP_TITLE=SmartPDF Convert
VITE_APP_LOGO=your_logo_url
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your_forge_api_key
VITE_FRONTEND_FORGE_API_KEY=your_frontend_forge_api_key
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im
VITE_ANALYTICS_ENDPOINT=your_analytics_endpoint
VITE_ANALYTICS_WEBSITE_ID=your_analytics_id

# Optional
TESTING_MODE=false  # Set to true for development without auth/payment
```

## Installation & Setup

**⚠️ Windows Users**: See [WINDOWS_SETUP.md](WINDOWS_SETUP.md) for Windows-specific instructions.

### 1. Clone the Repository

```bash
git clone https://github.com/Jzineldin/smartpdf-convert.git
cd smartpdf-convert
```

### 2. Install Dependencies

```bash
pnpm install
```

**Note**: If you encounter issues with `pnpm install`:
- Clear cache: `pnpm store prune`
- Try again: `pnpm install --force`
- Check Node version: `node --version` (should be v18+)

### 3. Set Up Environment Variables

Copy the template above and create a `.env` file in the root directory with your actual credentials.

### 4. Set Up Database

```bash
pnpm db:push
```

This command:
- Generates Drizzle migrations from the schema
- Applies migrations to your Supabase database
- Creates all required tables

### 5. Start Development Server

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`

## Build & Deployment

### Build for Production

```bash
pnpm build
```

This creates optimized bundles in the `dist/` directory.

### Start Production Server

```bash
pnpm start
```

## Testing

Run the test suite:

```bash
pnpm test
```

## Project Structure

```
smartpdf-convert/
├── client/                    # Frontend React app
│   ├── src/
│   │   ├── pages/            # Page components
│   │   ├── components/       # Reusable UI components
│   │   ├── contexts/         # React contexts (auth, etc)
│   │   ├── lib/              # Utilities (tRPC client, etc)
│   │   ├── App.tsx           # Main app with routing
│   │   └── index.css         # Global styles
│   ├── index.html            # HTML template with SEO meta tags
│   └── public/               # Static assets
├── server/                    # Backend Express app
│   ├── _core/                # Framework plumbing (auth, context, etc)
│   ├── db.ts                 # Database query helpers
│   ├── routers.ts            # tRPC procedure definitions
│   └── *.test.ts             # Test files
├── drizzle/                   # Database schema and migrations
│   └── schema.ts             # Table definitions
├── shared/                    # Shared types and constants
├── storage/                   # S3 storage helpers
├── package.json              # Dependencies and scripts
├── drizzle.config.ts         # Drizzle ORM config
└── README.md                 # This file
```

## Documentation Files

Make sure to read these files for complete setup information:

- **[WINDOWS_SETUP.md](WINDOWS_SETUP.md)** - Complete Windows 10/11 setup guide with all prerequisites
- **[DEPENDENCIES.md](DEPENDENCIES.md)** - Complete list of all 120+ npm packages and system requirements
- **[ENV_VARIABLES.md](ENV_VARIABLES.md)** - Detailed guide for all environment variables

## Key Files

- **`client/src/pages/Home.tsx`** - Landing page with hero, features, pricing, FAQ
- **`client/src/pages/convert.tsx`** - Main conversion page with file upload and template selector
- **`server/routers.ts`** - All tRPC procedures (extract, history, payments, etc)
- **`drizzle/schema.ts`** - Database schema (users, conversions, subscriptions)
- **`server/db.ts`** - Database query helpers

## Common Issues & Solutions

### Issue: `pnpm install` fails with permission errors

**Solution**:
```bash
# Clear pnpm cache
pnpm store prune

# Try installing with force flag
pnpm install --force

# If still failing, check Node version
node --version  # Should be v18+
```

### Issue: Database connection fails

**Solution**:
- Verify `DATABASE_URL` format: `mysql://user:password@host:port/dbname`
- Ensure MySQL server is running
- Check credentials are correct
- Verify database exists
- Try: `pnpm db:push --force`

### Issue: OpenRouter API errors during extraction

**Solution**:
- Verify `OPENROUTER_API_KEY` is valid
- Check API key has sufficient credits
- Ensure PDF/image file is under 20MB
- Try uploading a different file to test

### Issue: Stripe webhook not working

**Solution**:
- Add webhook endpoint in Stripe Dashboard: `https://yourdomain.com/api/webhooks/stripe`
- Use correct webhook signing secret in `.env`
- Ensure `STRIPE_SECRET_KEY` matches your Stripe account

### Issue: Port 3000 already in use

**Solution**:
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 pnpm dev
```

## Development Workflow

1. **Make changes** to code in `client/` or `server/`
2. **Hot reload** happens automatically (Vite for frontend, tsx watch for backend)
3. **Run tests** before committing: `pnpm test`
4. **Check types**: `pnpm check`
5. **Format code**: `pnpm format`

## API Endpoints

### Public Endpoints
- `GET /` - Landing page
- `POST /api/trpc/convert.extract` - Extract data from PDF/image

### Protected Endpoints (require authentication)
- `GET /api/trpc/user.me` - Get current user
- `GET /api/trpc/conversion.history` - Get user's conversion history
- `POST /api/trpc/subscription.upgrade` - Upgrade to Pro
- `POST /api/webhooks/stripe` - Stripe webhook handler

## Deployment

This project can be deployed to:
- **Vercel** - Recommended for Next.js-style projects
- **Railway** - Full-stack Node.js hosting
- **Render** - Similar to Railway
- **AWS EC2** - Manual setup required
- **Manus** - Built-in hosting platform

For deployment instructions, see the respective platform's documentation.

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes and test: `pnpm test`
3. Commit with clear messages: `git commit -m "Add feature description"`
4. Push and create a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the FAQ section on the landing page

## Roadmap

- [ ] Hybrid AI (Gemini Flash for simple docs, GPT-4V for complex)
- [ ] QuickBooks/Xero export formats
- [ ] Batch processing (multiple files at once)
- [ ] Custom extraction templates
- [ ] Mobile app
- [ ] API for third-party integrations

---

**Last Updated**: December 18, 2024
**Current Version**: 1.0.0
**Repository**: https://github.com/Jzineldin/smartpdf-convert
