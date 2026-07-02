# Project Rules & Workspace Status - WayToIAS

This file is automatically loaded by the AI assistant as a workspace instruction.

---

## 1. Local Codebase & Git Repository Structure 📁
All projects are physically stored within the same parent folder on your local machine (`E:\Coaching App`) to maintain local links, but are tracked as **three separate, independent Git repositories**:

### Repository 1: Web UI & Backend API (Root)
*   **Local Directory**: `E:\Coaching App`
*   **Git Repository**: [https://github.com/Chota-Thanos/Coaching-app](https://github.com/Chota-Thanos/Coaching-app) (Linked to branch `main`).
*   **Git Strategy**: The root [.gitignore](file:///E:/Coaching%20App/.gitignore) explicitly excludes the mobile app folders so they are not tracked under the main web/backend repo.
*   **Excluded Folders**:
    *   `/upsc_test_series/`
    *   `/current_affairs_pro/`

### Repository 2: UPSC Test Series Mobile App
*   **Local Directory**: `E:\Coaching App\upsc_test_series`
*   **Status**: Excluded from the root Git repo. It should be initialized and pushed to its own separate repository:
    ```bash
    cd "E:\Coaching App\upsc_test_series"
    git init
    git add .
    git commit -m "chore: initial commit for UPSC Test Series app"
    git branch -M main
    # Replace with your separate GitHub repository URL
    git remote add origin https://github.com/Chota-Thanos/upsc-test-series.git
    git push -u origin main
    ```

### Repository 3: Current Affairs Pro Mobile App
*   **Local Directory**: `E:\Coaching App\current_affairs_pro`
*   **Status**: Excluded from the root Git repo. It should be initialized and pushed to its own separate repository:
    ```bash
    cd "E:\Coaching App\current_affairs_pro"
    git init
    git add .
    git commit -m "chore: initial commit for Current Affairs Pro app"
    git branch -M main
    # Replace with your separate GitHub repository URL
    git remote add origin https://github.com/Chota-Thanos/current-affairs-pro.git
    git push -u origin main
    ```

---

## 2. Server Deployment Status ✅

### Server Provisioning & Configuration
*   **Vultr VPS IP**: `139.84.171.75`
*   **Host OS**: Ubuntu (Node.js 20 LTS, Nginx, PM2, and Git configured).
*   **SSH Credentials**: Configured passwordless SSH using your local key (`id_ed25519`).
*   **Swap Memory**: Activated active swap space to ensure memory-safe compiles of the Next.js application.
*   **UFW Firewall**: Open port `80` (HTTP), `443` (HTTPS), and `22` (SSH) to allow public access.

### Database Connection (Supabase)
*   **Host URL**: Switched from direct IPv6 connection to **Supabase Session Pooler** (`aws-1-ap-south-1.pooler.supabase.com:5432`). This resolved the `ENETUNREACH` connection error on Vultr's IPv4 routing network.
*   **Migrations**: Successfully ran all database migrations (`npm run db:migrate`) against your Supabase database.

### Application Running (PM2)
*   The application is deployed at `/var/www/coaching` on the Vultr server.
*   Managed by PM2 under two processes:
    *   `coaching-api` (Fastify Backend, running on port `4000`)
    *   `coaching-web` (Next.js Frontend, running on port `3000`)
*   PM2 auto-boot configurations have been saved (`pm2 save`) to automatically start both apps if the server reboots.

### Domain Routing & SSL (waytoias.com)
*   **Nginx configuration**: Routed port 80 requests matching `waytoias.com` and `www.waytoias.com` to Next.js (port 3000) and `/api/` requests to Fastify (port 4000).
*   **Next.js configuration**: Rebuilt the frontend application to bake in `https://waytoias.com` as the API target.
*   **CORS policy**: Updated the backend configuration to allow incoming API requests originating from `https://waytoias.com` and `https://www.waytoias.com`.

---

## 3. Remaining Tasks & Next Steps ⏳

### A. Apply Cloudflare Settings
Ensure your Cloudflare account has the following configurations:
1.  **DNS Records**:
    *   `A` record pointing `@` to `139.84.171.75` (Proxied - Orange Cloud).
    *   `CNAME` record pointing `www` to `@` (Proxied - Orange Cloud).
2.  **SSL/TLS Settings**:
    *   Encryption mode set to **Flexible** (ensures your site loads over `https` automatically without needing SSL certificates installed on the VPS).

### B. Implement Super-Admin & Email Verification
An implementation plan has been prepared in [implementation_plan.md](file:///C:/Users/Abrar/.gemini/antigravity/brain/e92de058-ef83-4e1e-89b3-e8c9b150a10c/implementation_plan.md). The tasks to execute are:
1.  **Create verification table**: Run a SQL migration to create `app.otp_verifications`.
2.  **Add SMTP Settings**: Add SMTP credentials (from Hostinger or other email provider) to `/var/www/coaching/.env`.
3.  **Update backend registration**: 
    *   Auto-verify and promote `abrarsaifi00@gmail.com` as an active Admin.
    *   Require OTP verification codes (dispatched via Nodemailer/SMTP) for all other student registrations.
4.  **Add frontend verification UI**: Create a `/verify` verification code submission page in Next.js.
