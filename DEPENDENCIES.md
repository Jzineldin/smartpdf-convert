# Complete Dependency List - SmartPDF Convert

## SYSTEM REQUIREMENTS (Must Install First)

### Required System Software
1. **Node.js** - v18.0.0 or higher
   - Download: https://nodejs.org/
   - Verify: `node --version`

2. **pnpm** - v10.4.1 or higher (package manager)
   - Install: `npm install -g pnpm@10.4.1`
   - Verify: `pnpm --version`

3. **Git** - Latest version
   - Download: https://git-scm.com/
   - Verify: `git --version`

4. **MySQL Server** - v8.0 or higher
   - Download: https://dev.mysql.com/downloads/mysql/
   - OR use Docker: `docker run -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=smartpdf_convert -p 3306:3306 mysql:8.0`
   - Verify: `mysql --version`

5. **GraphicsMagick** - For PDF to image conversion
   - **macOS**: `brew install graphicsmagick`
   - **Ubuntu/Debian**: `sudo apt-get install graphicsmagick`
   - **Windows**: Download from http://www.graphicsmagick.org/
   - **Alternative**: Ghostscript - `brew install ghostscript` (macOS) or `sudo apt-get install ghostscript` (Linux)

6. **Ghostscript** - PDF rendering engine
   - **macOS**: `brew install ghostscript`
   - **Ubuntu/Debian**: `sudo apt-get install ghostscript`
   - **Windows**: Download from https://www.ghostscript.com/download/gsdnld.html

---

## NPM DEPENDENCIES (Install via `pnpm install`)

### CORE FRAMEWORK & SERVER
- **express** ^4.21.2 - Web server framework
- **@trpc/server** ^11.6.0 - RPC framework (backend)
- **@trpc/client** ^11.6.0 - RPC framework (frontend)
- **@trpc/react-query** ^11.6.0 - React hooks for tRPC
- **superjson** ^1.13.3 - JSON serialization with Date support
- **jose** 6.1.0 - JWT token handling
- **cookie** ^1.0.2 - Cookie parsing and handling

### DATABASE & ORM
- **drizzle-orm** ^0.44.5 - SQL ORM
- **mysql2** ^3.15.0 - MySQL driver
- **drizzle-kit** ^0.31.4 - Drizzle migration tool (devDependency)

### FRONTEND FRAMEWORK
- **react** ^19.2.1 - UI library
- **react-dom** ^19.2.1 - React DOM rendering
- **wouter** ^3.3.5 - Lightweight routing
- **@tanstack/react-query** ^5.90.2 - Data fetching & caching

### STYLING & UI COMPONENTS
- **tailwindcss** ^4.1.14 - Utility-first CSS
- **@tailwindcss/vite** ^4.1.3 - Tailwind Vite plugin
- **tailwind-merge** ^3.3.1 - Merge Tailwind classes
- **tailwindcss-animate** ^1.0.7 - Animation utilities
- **@tailwindcss/typography** ^0.5.15 - Typography plugin (devDependency)

### RADIX UI COMPONENTS (20+ packages)
- **@radix-ui/react-accordion** ^1.2.12
- **@radix-ui/react-alert-dialog** ^1.1.15
- **@radix-ui/react-aspect-ratio** ^1.1.7
- **@radix-ui/react-avatar** ^1.1.10
- **@radix-ui/react-checkbox** ^1.3.3
- **@radix-ui/react-collapsible** ^1.1.12
- **@radix-ui/react-context-menu** ^2.2.16
- **@radix-ui/react-dialog** ^1.1.15
- **@radix-ui/react-dropdown-menu** ^2.1.16
- **@radix-ui/react-hover-card** ^1.1.15
- **@radix-ui/react-label** ^2.1.7
- **@radix-ui/react-menubar** ^1.1.16
- **@radix-ui/react-navigation-menu** ^1.2.14
- **@radix-ui/react-popover** ^1.1.15
- **@radix-ui/react-progress** ^1.1.7
- **@radix-ui/react-radio-group** ^1.3.8
- **@radix-ui/react-scroll-area** ^1.2.10
- **@radix-ui/react-select** ^2.2.6
- **@radix-ui/react-separator** ^1.1.7
- **@radix-ui/react-slider** ^1.3.6
- **@radix-ui/react-slot** ^1.2.3
- **@radix-ui/react-switch** ^1.2.6
- **@radix-ui/react-tabs** ^1.1.13
- **@radix-ui/react-toggle** ^1.1.10
- **@radix-ui/react-toggle-group** ^1.1.11
- **@radix-ui/react-tooltip** ^1.2.8

### ICONS & GRAPHICS
- **lucide-react** ^0.453.0 - Icon library
- **canvas-confetti** ^1.9.4 - Confetti animation

### PDF & IMAGE PROCESSING
- **pdf-lib** ^1.17.1 - PDF manipulation (page count detection)
- **pdf2pic** ^3.2.0 - PDF to image conversion
- **graphicsmagick** ^0.0.1 - Image processing wrapper
- **sharp** ^0.34.5 - Image resizing/optimization

### SPREADSHEET & EXCEL
- **@fortune-sheet/react** ^1.0.4 - Spreadsheet editor component
- **@handsontable/react** ^16.2.0 - Handsontable spreadsheet
- **handsontable** ^16.2.0 - Handsontable core
- **exceljs** ^4.4.0 - Excel file generation
- **xlsx** ^0.18.5 - Excel file parsing

### FILE HANDLING
- **file-saver** ^2.0.5 - Save files to disk
- **react-dropzone** ^14.3.8 - Drag-and-drop file upload

### AUTHENTICATION & SECURITY
- **@supabase/supabase-js** ^2.88.0 - Supabase client (auth only)

### PAYMENTS
- **stripe** ^20.1.0 - Stripe payment processing

### FORM HANDLING & VALIDATION
- **react-hook-form** ^7.64.0 - Form state management
- **@hookform/resolvers** ^5.2.2 - Form validation resolvers
- **zod** ^4.1.12 - Schema validation

### ANIMATIONS & MOTION
- **framer-motion** ^12.23.22 - Animation library
- **embla-carousel-react** ^8.6.0 - Carousel component

### UI UTILITIES
- **clsx** ^2.1.1 - Conditional className utility
- **class-variance-authority** ^0.7.1 - Component variant management
- **cmdk** ^1.1.1 - Command palette component
- **input-otp** ^1.4.2 - OTP input component
- **react-day-picker** ^9.11.1 - Date picker
- **react-resizable-panels** ^3.0.6 - Resizable panels
- **vaul** ^1.1.2 - Drawer component

### NOTIFICATIONS & FEEDBACK
- **sonner** ^2.0.7 - Toast notifications

### CHARTS & VISUALIZATION
- **recharts** ^2.15.2 - React charts library

### MARKDOWN & CONTENT
- **streamdown** ^1.4.0 - Markdown streaming/rendering

### UTILITIES
- **date-fns** ^4.1.0 - Date manipulation
- **nanoid** ^5.1.5 - Unique ID generation
- **uuid** ^13.0.0 - UUID generation
- **axios** ^1.12.0 - HTTP client
- **dotenv** ^17.2.2 - Environment variable loading

### THEMING
- **next-themes** ^0.4.6 - Dark/light theme management

### AWS S3 (File Storage)
- **@aws-sdk/client-s3** ^3.693.0 - S3 client
- **@aws-sdk/s3-request-presigner** ^3.693.0 - S3 presigned URLs

---

## DEV DEPENDENCIES (Install via `pnpm install`)

### BUILD & BUNDLING
- **vite** ^7.1.7 - Frontend build tool
- **@vitejs/plugin-react** ^5.0.4 - Vite React plugin
- **esbuild** ^0.25.0 - JavaScript bundler
- **vite-plugin-manus-runtime** ^0.0.57 - Manus platform plugin

### TYPE CHECKING
- **typescript** 5.9.3 - TypeScript compiler
- **@types/node** ^24.7.0 - Node.js type definitions
- **@types/react** ^19.2.1 - React type definitions
- **@types/react-dom** ^19.2.1 - React DOM type definitions
- **@types/express** 4.17.21 - Express type definitions
- **@types/file-saver** ^2.0.7 - FileSaver type definitions
- **@types/uuid** ^11.0.0 - UUID type definitions
- **@types/canvas-confetti** ^1.9.0 - Confetti type definitions
- **@types/google.maps** ^3.58.1 - Google Maps type definitions

### TESTING
- **vitest** ^2.1.4 - Unit testing framework
- **@builder.io/vite-plugin-jsx-loc** ^0.1.1 - JSX location plugin

### CODE QUALITY
- **prettier** ^3.6.2 - Code formatter
- **autoprefixer** ^10.4.20 - CSS vendor prefixes
- **postcss** ^8.4.47 - CSS processing

### RUNTIME TOOLS
- **tsx** ^4.19.1 - TypeScript execution
- **pnpm** ^10.15.1 - Package manager (also a devDependency)
- **add** ^2.0.6 - npm add alternative
- **tw-animate-css** ^1.4.0 - Tailwind animation CSS

---

## PNPM-SPECIFIC CONFIGURATION

### Patched Dependencies
- **wouter@3.7.1** - Has a custom patch applied (see `patches/wouter@3.7.1.patch`)

### Overrides
- **tailwindcss>nanoid** - Overridden to v3.3.7

### Only Built Dependencies
- **sharp** - Compiled native module, only built version used

---

## ENVIRONMENT VARIABLES NEEDED

```env
# Database
DATABASE_URL=mysql://username:password@host:3306/database_name

# Supabase Auth
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# JWT & OAuth
JWT_SECRET=your_secret_key_min_32_chars
VITE_OAUTH_PORTAL_URL=https://api.manus.im
OWNER_OPEN_ID=your_owner_open_id
OWNER_NAME=your_name

# AI/LLM
OPENROUTER_API_KEY=sk-or-v1-xxxxx

# Stripe
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_PRO_PRICE_ID=price_1SfTwqGwHa557mvPhCaAtOE7

# AWS S3
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=your_bucket_name

# Manus Platform
VITE_APP_ID=your_app_id
VITE_APP_TITLE=SmartPDF Convert
VITE_APP_LOGO=your_logo_url
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your_key
VITE_FRONTEND_FORGE_API_KEY=your_key
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im
VITE_ANALYTICS_ENDPOINT=your_endpoint
VITE_ANALYTICS_WEBSITE_ID=your_id

# Development
TESTING_MODE=false
```

---

## INSTALLATION CHECKLIST

### Step 1: System Setup
- [ ] Install Node.js v18+
- [ ] Install pnpm v10+
- [ ] Install Git
- [ ] Install MySQL 8.0+
- [ ] Install GraphicsMagick
- [ ] Install Ghostscript

### Step 2: Clone & Install
- [ ] Clone repository: `git clone https://github.com/Jzineldin/smartpdf-convert.git`
- [ ] Navigate: `cd smartpdf-convert`
- [ ] Install dependencies: `pnpm install`

### Step 3: Configuration
- [ ] Create `.env` file with all variables above
- [ ] Verify MySQL is running
- [ ] Test MySQL connection: `mysql -u root -p -h localhost`

### Step 4: Database Setup
- [ ] Run migrations: `pnpm db:push`
- [ ] Verify tables created: `mysql -u root -p smartpdf_convert`

### Step 5: Run Application
- [ ] Start dev server: `pnpm dev`
- [ ] Open browser: `http://localhost:3000`
- [ ] Test file upload and extraction

---

## OPTIONAL DEPENDENCIES FOR DEVELOPMENT

If you want to extend the project:

### For API Testing
- `rest-client` - VS Code extension for testing API endpoints

### For Database Management
- `mysql-workbench` - GUI for MySQL
- `dbeaver` - Universal database tool

### For PDF Testing
- `pdfjs-dist` - PDF.js for browser-based PDF viewing

### For Image Processing
- `imagemagick` - Alternative to GraphicsMagick

---

## QUICK START COMMAND

Copy-paste this entire command to install everything:

```bash
# 1. Install system dependencies (macOS)
brew install node graphicsmagick ghostscript mysql

# 2. Install pnpm globally
npm install -g pnpm@10.4.1

# 3. Clone and setup
git clone https://github.com/Jzineldin/smartpdf-convert.git
cd smartpdf-convert

# 4. Install all npm packages
pnpm install

# 5. Create .env file (edit with your credentials)
cp .env.example .env

# 6. Start MySQL (if using local installation)
mysql.server start

# 7. Run database migrations
pnpm db:push

# 8. Start development server
pnpm dev
```

---

## TROUBLESHOOTING LIBRARY ISSUES

### GraphicsMagick/Ghostscript not found
```bash
# macOS
brew install graphicsmagick ghostscript

# Ubuntu/Debian
sudo apt-get install graphicsmagick ghostscript

# Windows
# Download from http://www.graphicsmagick.org/
# Add to PATH environment variable
```

### Sharp compilation fails
```bash
pnpm install --force
# or
npm rebuild sharp
```

### MySQL connection refused
```bash
# Check if MySQL is running
mysql -u root -p

# Start MySQL (macOS)
mysql.server start

# Start MySQL (Ubuntu)
sudo service mysql start

# Docker
docker run -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=smartpdf_convert -p 3306:3306 mysql:8.0
```

### pnpm install hangs
```bash
pnpm store prune
pnpm install --force
```

### Node version mismatch
```bash
node --version  # Should be v18+
nvm install 18  # If using nvm
nvm use 18
```

---

**Last Updated**: December 18, 2024
**Total Dependencies**: 120+ npm packages + 6 system requirements
