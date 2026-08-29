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
#
# Next's build type-checks the whole app in one Node process. On this box Node
# sizes its own heap from available RAM and lands around 490 MB, which the
# type-check phase now exceeds — it dies with "Ineffective mark-compacts near
# heap limit". Raising the ceiling fixes it, but only if the kernel has
# somewhere to spill: with ~1 GB of RAM and no swap, a bigger heap just moves
# the failure from V8's OOM to the kernel's OOM killer. Check swap first.
SWAP_MB="$(free -m 2>/dev/null | awk '/^Swap:/ {print $2}')"
if [ -z "$SWAP_MB" ]; then SWAP_MB=0; fi
if [ "$SWAP_MB" -lt 1024 ]; then
  echo "⚠️  Less than 1 GB of swap detected. If the build is killed, add some:"
  echo "     fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile"
  echo "     echo '/swapfile none swap sw 0 0' >> /etc/fstab   # persist across reboots"
fi

echo "🛠️ Building API and Web applications..."
NODE_OPTIONS="--max-old-space-size=${NODE_BUILD_HEAP_MB:-3072}" npm run build

# 4b. tools/posting-agent-mcp is deliberately NOT an npm workspace (adding it
# would make the two steps above install/build it on every deploy whether or
# not this server is in use), so it needs its own explicit step here.
if [ -f tools/posting-agent-mcp/package.json ]; then
  echo "🔌 Building the MCP connector (posting-agent-mcp)..."
  npm --prefix tools/posting-agent-mcp install
  npm --prefix tools/posting-agent-mcp run build
fi

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
