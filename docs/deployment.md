# Deployment Guide

## Live server

- Host: `139.84.171.75`, SSH as `root`.
- App directory on the server: `/var/www/coaching`.
- Process manager: PM2, config at repo root (`ecosystem.config.cjs`) — runs `coaching-api` (port 4000) and `coaching-web` (`next start`, port 3000).
- Database: Supabase (aws-1 pooler, ap-south-1). Migrations run via `npm run db:migrate` against `DATABASE_URL`.
- Credentials (SSH password, `DATABASE_URL`, `JWT_SECRET`) live in `scratch/deploy_app.js` at the repo root. That folder is gitignored and has never been committed — do not move these values into a tracked file.

## Connecting via SSH

Windows machines that already have an SSH key set up (for example a GitHub key at `~/.ssh/id_ed25519`) will get prompted for that key's **passphrase** instead of the server's password, because SSH tries public-key authentication first and stops to unlock the local key before ever asking the server for a password. A passphrase and a password are two different secrets — typing the server's root password into a "passphrase" prompt will never work.

Force password authentication explicitly so it skips the local key:

```bash
ssh -o PubkeyAuthentication=no -o PreferredAuthentications=password root@139.84.171.75
```

That should prompt `root@139.84.171.75's password:` — that's where the server's root password goes.

## Deploying

Once connected:

```bash
cd /var/www/coaching
bash deploy.sh
```

`deploy.sh` runs, in order:

1. `git pull origin main`
2. `npm install`
3. `npm run db:migrate`
4. `npm run build` (builds both `apps/api` and `apps/web`)
5. `pm2 restart ecosystem.config.cjs --env production` (or `pm2 start` if the processes aren't already running)
6. `pm2 save`

If any step fails, the script exits immediately (`set -e`) rather than continuing partway through a broken deploy.

## Deployment Log

Record every deployment here — date, commit(s) shipped, a one-line summary, who/what ran it, and the outcome. Add a new row per deployment; don't edit past rows except to fix a factual error.

| Date | Commit(s) | Summary | Run by | Outcome |
|------|-----------|---------|--------|---------|
| 2026-07-18 | `3467564` | Web Study Plans typography fix + roadmap/curriculum redesign to match the mobile app | User, manual SSH (`deploy.sh`) | _pending confirmation_ |
