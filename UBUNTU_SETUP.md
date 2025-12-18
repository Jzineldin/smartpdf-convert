# SmartPDF Convert - Ubuntu Setup Guide

This guide walks you through setting up SmartPDF Convert on Ubuntu 20.04/22.04/24.04.

## Prerequisites - Install in This Order

### 1. Update System Packages
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Node.js (v18+)
```bash
# Install Node.js using NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version   # Should show v18.x.x or higher
npm --version    # Should show 9.x.x or higher
```

### 3. Install pnpm (v10+)
```bash
# Install pnpm globally
sudo npm install -g pnpm@10.4.1

# Verify installation
pnpm --version   # Should show 10.4.1 or higher
```

### 4. Install Git
```bash
sudo apt install -y git

# Verify installation
git --version
```

### 5. Install MySQL Server (v8.0)
```bash
# Install MySQL
sudo apt install -y mysql-server

# Start MySQL service
sudo systemctl start mysql
sudo systemctl enable mysql

# Secure MySQL installation (set root password)
sudo mysql_secure_installation

# Verify installation
mysql --version
```

**Alternative: Use Docker for MySQL**
```bash
# Install Docker first
sudo apt install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Log out and back in, then run MySQL container
docker run --name mysql -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=smartpdf_convert -p 3306:3306 -d mysql:8.0
```

### 6. Install GraphicsMagick (Required for PDF conversion)
```bash
sudo apt install -y graphicsmagick

# Verify installation
gm version
```

### 7. Install Ghostscript (Required for PDF rendering)
```bash
sudo apt install -y ghostscript

# Verify installation
gs --version
```

### 8. Install Build Essentials (for native modules like Sharp)
```bash
sudo apt install -y build-essential python3
```

---

## Step-by-Step Setup

### Step 1: Clone the Repository
```bash
cd ~
git clone https://github.com/Jzineldin/smartpdf-convert.git
cd smartpdf-convert
```

### Step 2: Install Dependencies
```bash
pnpm install
```

**If this fails**, try:
```bash
pnpm store prune
pnpm install --force
```

### Step 3: Create Environment File
```bash
# Create .env file
nano .env
```

Paste this content and fill in your values:
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

Save with `Ctrl+O`, then exit with `Ctrl+X`.

### Step 4: Create MySQL Database
```bash
# Connect to MySQL
sudo mysql -u root -p

# Create database
CREATE DATABASE smartpdf_convert;
EXIT;
```

**If you can't login with root password:**
```bash
# Reset MySQL root password
sudo mysql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'your_new_password';
FLUSH PRIVILEGES;
EXIT;
```

### Step 5: Run Database Migrations
```bash
pnpm db:push
```

### Step 6: Start Development Server
```bash
pnpm dev
```

You should see:
```
Server running on http://localhost:3000
```

Open your browser and go to: `http://localhost:3000`

---

## Quick Install Script

Copy and run this entire script to install all prerequisites:

```bash
#!/bin/bash

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
sudo npm install -g pnpm@10.4.1

# Install Git
sudo apt install -y git

# Install MySQL
sudo apt install -y mysql-server

# Install GraphicsMagick and Ghostscript
sudo apt install -y graphicsmagick ghostscript

# Install build tools
sudo apt install -y build-essential python3

# Start MySQL
sudo systemctl start mysql
sudo systemctl enable mysql

# Verify installations
echo "=== Verification ==="
node --version
npm --version
pnpm --version
git --version
mysql --version
gm version | head -1
gs --version

echo "=== All prerequisites installed! ==="
```

Save as `install-prerequisites.sh` and run:
```bash
chmod +x install-prerequisites.sh
./install-prerequisites.sh
```

---

## Ubuntu-Specific Troubleshooting

### Issue: "Permission denied" when installing pnpm
**Solution**:
```bash
sudo npm install -g pnpm@10.4.1
```

### Issue: "Cannot connect to MySQL"
**Solution**:
```bash
# Check if MySQL is running
sudo systemctl status mysql

# Start MySQL if not running
sudo systemctl start mysql

# Check MySQL is listening on port 3306
sudo netstat -tlnp | grep 3306
```

### Issue: "Access denied for user 'root'@'localhost'"
**Solution**:
```bash
# Login without password first
sudo mysql

# Set password for root
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'your_password';
FLUSH PRIVILEGES;
EXIT;

# Update DATABASE_URL in .env
DATABASE_URL=mysql://root:your_password@localhost:3306/smartpdf_convert
```

### Issue: "gm: command not found"
**Solution**:
```bash
sudo apt install -y graphicsmagick
```

### Issue: "gs: command not found"
**Solution**:
```bash
sudo apt install -y ghostscript
```

### Issue: "sharp" module fails to build
**Solution**:
```bash
# Install build dependencies
sudo apt install -y build-essential python3

# Rebuild sharp
pnpm rebuild sharp

# Or reinstall all dependencies
pnpm install --force
```

### Issue: "EACCES: permission denied" during pnpm install
**Solution**:
```bash
# Fix npm permissions
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Reinstall pnpm
npm install -g pnpm@10.4.1
```

### Issue: Port 3000 already in use
**Solution**:
```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill the process
sudo kill -9 <PID>

# Or use a different port
PORT=3001 pnpm dev
```

### Issue: "node: command not found" after installation
**Solution**:
```bash
# Reload shell
source ~/.bashrc

# Or restart terminal
```

---

## Firewall Configuration (Optional)

If you need to access the app from another machine:

```bash
# Allow port 3000
sudo ufw allow 3000

# Check firewall status
sudo ufw status
```

---

## Running as a Service (Production)

To run SmartPDF Convert as a background service:

### Create systemd service file
```bash
sudo nano /etc/systemd/system/smartpdf.service
```

Add this content:
```ini
[Unit]
Description=SmartPDF Convert
After=network.target mysql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/smartpdf-convert
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Enable and start the service
```bash
# Build for production first
cd ~/smartpdf-convert
pnpm build

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable smartpdf
sudo systemctl start smartpdf

# Check status
sudo systemctl status smartpdf

# View logs
sudo journalctl -u smartpdf -f
```

---

## Verify Everything is Working

Run these commands to verify your setup:

```bash
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
sudo systemctl status mysql

# Check GraphicsMagick
gm version | head -1

# Check Ghostscript
gs --version

# Check if all installed
echo "=== All checks complete ==="
```

---

## Common Commands Reference

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run tests
pnpm test

# Run database migrations
pnpm db:push

# Format code
pnpm format

# Type check
pnpm check
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

**Last Updated**: December 18, 2024
**Tested On**: Ubuntu 20.04, 22.04, 24.04 with Node 18+, pnpm 10.4.1, MySQL 8.0
