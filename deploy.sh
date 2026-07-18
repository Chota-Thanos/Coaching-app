#!/bin/bash
# Run this ON the live server, from the repo root (/var/www/coaching), after
# connecting via SSH. See docs/deployment.md for the SSH connection gotcha
# (Windows clients get stuck on a local key passphrase prompt instead of the
# server password) and for the deployment log to record each run in.

# Exit on error
set -e

echo "🚀 Starting deployment..."

# 1. Pull latest code
echo "📥 Pulling latest changes from Git..."
git pull origin main

# 2. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 3. Run migrations on the Supabase database
echo "🗄️ Running database migrations..."
npm run db:migrate

# 4. Build application
echo "🛠️ Building API and Web applications..."
npm run build

# 5. Restart application processes via PM2
echo "🔄 Restarting application services..."
if pm2 list | grep -q "coaching-api"; then
  pm2 restart ecosystem.config.cjs --env production
else
  pm2 start ecosystem.config.cjs --env production
fi

# 6. Save PM2 state
pm2 save

echo "🎉 Deployment complete!"
