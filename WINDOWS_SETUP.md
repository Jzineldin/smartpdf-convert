# SmartPDF Convert - Windows Setup Guide

This guide walks you through setting up SmartPDF Convert on Windows 10/11.

## Prerequisites - Install in This Order

### 1. Node.js (Required)
- **Download**: https://nodejs.org/ (LTS version 18+)
- **Installation**:
  1. Run the installer
  2. Check "Add to PATH" during installation
  3. Restart your computer
  4. Verify: Open Command Prompt and run:
     ```cmd
     node --version
     npm --version
     ```

### 2. Git (Required)
- **Download**: https://git-scm.com/download/win
- **Installation**:
  1. Run the installer with default settings
  2. Restart your computer
  3. Verify: Open Command Prompt and run:
     ```cmd
     git --version
     ```

### 3. pnpm (Required)
- **Installation**: Open Command Prompt as Administrator and run:
  ```cmd
  npm install -g pnpm@10.4.1
  ```
- **Verify**:
  ```cmd
  pnpm --version
  ```

### 4. MySQL Server (Required)
- **Download**: https://dev.mysql.com/downloads/mysql/
- **Installation**:
  1. Download MySQL Server 8.0 Community Edition
  2. Run the installer
  3. Choose "Server Machine" setup type
  4. Choose "Standalone MySQL Server / Classic MySQL Server"
  5. Accept defaults for most settings
  6. When asked for port, use default 3306
  7. Configure MySQL Server as Windows Service
  8. Set root password (remember this!)
  9. Complete the installation
  10. Verify: Open Command Prompt and run:
      ```cmd
      mysql --version
      mysql -u root -p
      ```
      (Enter your root password when prompted)

**Alternative: Use Docker for MySQL**
If you don't want to install MySQL directly:
- **Download Docker Desktop**: https://www.docker.com/products/docker-desktop
- **Run MySQL in Docker**:
  ```cmd
  docker run --name mysql -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=smartpdf_convert -p 3306:3306 -d mysql:8.0
  ```

### 5. GraphicsMagick (Required for PDF conversion)
- **Download**: http://www.graphicsmagick.org/download.html
- **Installation**:
  1. Download the Windows binary (e.g., `GraphicsMagick-1.3.xx-Q16-win64-dll.exe`)
  2. Run the installer
  3. **IMPORTANT**: Check "Add application directory to your system path"
  4. Complete installation
  5. Verify: Open Command Prompt and run:
     ```cmd
     gm --version
     ```

### 6. Ghostscript (Required for PDF rendering)
- **Download**: https://www.ghostscript.com/download/gsdnld.html
- **Installation**:
  1. Download the Windows installer (64-bit recommended)
  2. Run the installer with default settings
  3. **IMPORTANT**: Note the installation path (usually `C:\Program Files\gs\gs9.xx\bin`)
  4. Add to PATH manually if not done automatically:
     - Open System Properties → Environment Variables
     - Add Ghostscript bin folder to PATH
  5. Verify: Open Command Prompt and run:
     ```cmd
     gswin64c --version
     ```

---

## Step-by-Step Setup

### Step 1: Clone the Repository

1. Open Command Prompt or PowerShell
2. Navigate to where you want the project:
   ```cmd
   cd C:\Users\YourUsername\Documents
   ```
3. Clone the repository:
   ```cmd
   git clone https://github.com/Jzineldin/smartpdf-convert.git
   cd smartpdf-convert
   ```

### Step 2: Install Dependencies

1. In the project directory, run:
   ```cmd
   pnpm install
   ```
   
   **If this fails**, try:
   ```cmd
   pnpm store prune
   pnpm install --force
   ```

2. Wait for installation to complete (this may take 5-10 minutes)

### Step 3: Create Environment File

1. In the project root, create a file named `.env` (no extension)
2. Copy this content and fill in your values:

```env
# Database (MySQL)
DATABASE_URL=mysql://root:your_password@localhost:3306/smartpdf_convert

# Supabase Auth
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# JWT & OAuth
JWT_SECRET=your_secret_key_min_32_chars_long_enough
VITE_OAUTH_PORTAL_URL=https://api.manus.im
OWNER_OPEN_ID=your_owner_open_id
OWNER_NAME=Your Name

# AI/LLM (OpenRouter)
OPENROUTER_API_KEY=sk-or-v1-your_key_here

# Stripe
STRIPE_SECRET_KEY=sk_live_your_stripe_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_key
STRIPE_PRO_PRICE_ID=price_1SfTwqGwHa557mvPhCaAtOE7

# AWS S3
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
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

### Step 4: Create MySQL Database

1. Open Command Prompt and connect to MySQL:
   ```cmd
   mysql -u root -p
   ```
   (Enter your root password)

2. Create the database:
   ```sql
   CREATE DATABASE smartpdf_convert;
   EXIT;
   ```

### Step 5: Run Database Migrations

In the project directory, run:
```cmd
pnpm db:push
```

This creates all the necessary tables.

### Step 6: Start Development Server

```cmd
pnpm dev
```

You should see:
```
Server running on http://localhost:3000
```

Open your browser and go to: `http://localhost:3000`

---

## Windows-Specific Troubleshooting

### Issue: "pnpm is not recognized"
**Solution**:
```cmd
npm install -g pnpm@10.4.1
```
Then restart Command Prompt.

### Issue: "mysql is not recognized"
**Solution**:
1. Verify MySQL is installed: `C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe`
2. Add to PATH:
   - Right-click "This PC" → Properties
   - Click "Advanced system settings"
   - Click "Environment Variables"
   - Under "System variables", find "Path" and click "Edit"
   - Click "New" and add: `C:\Program Files\MySQL\MySQL Server 8.0\bin`
   - Click OK and restart Command Prompt

### Issue: "gm (GraphicsMagick) is not recognized"
**Solution**:
1. Verify installation: `C:\Program Files\GraphicsMagick-1.3.xx`
2. Add to PATH (same steps as MySQL above):
   - Add: `C:\Program Files\GraphicsMagick-1.3.xx`
   - Restart Command Prompt

### Issue: "gswin64c (Ghostscript) is not recognized"
**Solution**:
1. Find Ghostscript installation:
   ```cmd
   dir "C:\Program Files\gs"
   ```
2. Add the bin folder to PATH:
   - Example: `C:\Program Files\gs\gs9.56.1\bin`
   - Restart Command Prompt

### Issue: "pnpm install" hangs or fails
**Solution**:
```cmd
pnpm store prune
pnpm install --force
```

### Issue: "Port 3000 already in use"
**Solution**:
```cmd
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with the number shown)
taskkill /PID <PID> /F

# Or use a different port
set PORT=3001
pnpm dev
```

### Issue: "DATABASE_URL is required"
**Solution**:
- Verify `.env` file exists in project root
- Check DATABASE_URL is set correctly
- Format should be: `mysql://root:password@localhost:3306/smartpdf_convert`
- Verify MySQL is running

### Issue: "Cannot find module 'sharp'"
**Solution**:
```cmd
pnpm install --force
npm rebuild sharp
```

### Issue: "PDF to image conversion fails"
**Solution**:
1. Verify GraphicsMagick is installed:
   ```cmd
   gm --version
   ```
2. Verify Ghostscript is installed:
   ```cmd
   gswin64c --version
   ```
3. If either is missing, reinstall and add to PATH
4. Restart Command Prompt and try again

### Issue: "Node version mismatch"
**Solution**:
```cmd
node --version
```
Should show v18.0.0 or higher. If not, reinstall Node.js from https://nodejs.org/

---

## Verify Everything is Working

Run these commands to verify your setup:

```cmd
# Check Node
node --version

# Check npm
npm --version

# Check pnpm
pnpm --version

# Check Git
git --version

# Check MySQL
mysql --version
mysql -u root -p -e "SELECT VERSION();"

# Check GraphicsMagick
gm --version

# Check Ghostscript
gswin64c --version
```

All should return version numbers without errors.

---

## Common Environment Variable Issues

### For Supabase Auth (Optional for Testing)
If you don't have Supabase set up yet:
1. Go to https://supabase.com
2. Create a new project
3. Copy the URL and anon key from Project Settings → API
4. Paste into `.env`

### For OpenRouter API Key
1. Go to https://openrouter.ai
2. Sign up and create an API key
3. Paste into `.env` as `OPENROUTER_API_KEY`

### For Stripe Keys
1. Go to https://stripe.com
2. Create account and get Live keys
3. Paste into `.env`

### For AWS S3
1. Create AWS account
2. Create S3 bucket
3. Create IAM user with S3 access
4. Get access key and secret
5. Paste into `.env`

---

## Running the Application

### Development Mode
```cmd
pnpm dev
```
- Hot reload enabled
- Slower startup
- Good for development

### Production Build
```cmd
pnpm build
pnpm start
```
- Optimized for performance
- Faster startup
- For deployment

### Run Tests
```cmd
pnpm test
```

### Format Code
```cmd
pnpm format
```

---

## Project Structure

```
smartpdf-convert/
├── client/                 # React frontend
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable components
│   │   ├── lib/           # Utilities
│   │   └── App.tsx        # Main app
│   └── index.html         # HTML template
├── server/                 # Express backend
│   ├── routers.ts         # API endpoints
│   ├── db.ts              # Database helpers
│   └── _core/             # Framework code
├── drizzle/               # Database schema
│   └── schema.ts          # Table definitions
├── .env                   # Environment variables (create this)
├── package.json           # Dependencies
└── README.md              # Documentation
```

---

## Next Steps

1. ✅ Install all prerequisites
2. ✅ Clone repository
3. ✅ Install dependencies with `pnpm install`
4. ✅ Create `.env` file
5. ✅ Create MySQL database
6. ✅ Run `pnpm db:push`
7. ✅ Start with `pnpm dev`
8. Open `http://localhost:3000`
9. Test by uploading a PDF

---

## Getting Help

If you encounter issues:

1. **Check the error message** - It usually tells you what's wrong
2. **Check this guide** - Look in the Troubleshooting section
3. **Check DEPENDENCIES.md** - Full list of all requirements
4. **Check README.md** - General setup information
5. **Open an issue on GitHub** - With the full error message

---

**Last Updated**: December 18, 2024
**Tested On**: Windows 10/11 with Node 18+, pnpm 10.4.1, MySQL 8.0
