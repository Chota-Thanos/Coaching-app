# Google Sign-In & Razorpay — Activation Guide

This document explains how to turn on **Google Sign-In** (web + mobile) and
**Razorpay payments** (web). The application code for all of this already
exists; what remains is creating the external accounts/credentials and placing
the values in the right config. Credentials (especially the Razorpay secret)
must be entered by you — they are not committed to the repo.

---

## What is already wired in code

| Piece | Status | Notes |
|-------|--------|-------|
| Backend Google token verification | ✅ Done | `POST /api/v1/auth/google` validates the ID token with Google and checks its audience against `GOOGLE_CLIENT_ID_*`. |
| Web "Sign in with Google" button | ✅ Done | `apps/web/src/components/auth/google-signin-button.tsx`, rendered on both `/login` and `/register`. Reads `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. |
| Mobile Google Sign-In | ✅ Done | `login_screen.dart` uses the `google_sign_in` package and passes `serverClientId` (`ApiConstants.googleServerClientId`). |
| Razorpay backend (orders + verify) | ✅ Done | `billing` and `mentorship` modules. Real when `RAZORPAY_KEY_ID`/`_SECRET` set, otherwise **simulated** mode. |
| Web Razorpay checkout | ✅ Done | `checkout.razorpay.com` loaded in `layout.tsx`; used by pricing, study plans, and mentorship. The public `key_id` is returned by the backend per-order — no separate web key needed. |

So "activation" = create the credentials, set the env vars, (for mobile) add
the native OAuth clients, then restart/rebuild.

---

## Part 1 — Google Sign-In

### 1.1 Create the OAuth clients (Google Cloud Console)

1. Go to <https://console.cloud.google.com/> → create or select a project.
2. **APIs & Services → OAuth consent screen**: configure it (External), add app
   name, support email, and (for production) your domain. Add the scopes
   `email`, `profile`, `openid`. While in "Testing", add test-user emails.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**, and
   create these clients as needed:

   **a) Web application** (required — used by the website AND as the mobile
   `serverClientId`):
   - Authorized JavaScript origins: `http://localhost:3000` (dev) and your prod
     origin, e.g. `https://waytoias.com`.
   - Authorized redirect URIs: not required for the Google Identity Services
     button flow, but harmless to add your origins.
   - Copy the generated **Client ID** → this is `GOOGLE_CLIENT_ID_WEB` /
     `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

   **b) Android** (only for the Android app):
   - Package name: `com.coachingapp.upsc_test_series`
   - SHA-1 certificate fingerprint: get it with
     `cd upsc_test_series/android && ./gradlew signingReport` (use the debug
     SHA-1 for testing, and your **release keystore** SHA-1 for production).
   - No client ID needs to go into the app for Android; Google matches by
     package + SHA-1. Copy the Client ID into `GOOGLE_CLIENT_ID_ANDROID` if you
     want the backend to also accept Android-audienced tokens (optional).

   **c) iOS** (only for the iOS app):
   - Bundle ID: `com.coachingapp.upscTestSeries`
   - Download the `GoogleService-Info.plist` (or note the iOS client ID and its
     reversed client ID). Copy the Client ID into `GOOGLE_CLIENT_ID_IOS`
     (optional, same reasoning as Android).

### 1.2 Set the backend + web env vars

In the **root `.env`** (loaded by the API) — see `.env.example` for the block:

```
GOOGLE_CLIENT_ID_WEB=<web-client-id>.apps.googleusercontent.com
# optional, only if you created them:
GOOGLE_CLIENT_ID_ANDROID=<android-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_ID_IOS=<ios-client-id>.apps.googleusercontent.com
```

In **`apps/web/.env`** (Next.js inlines this at build time):

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<web-client-id>.apps.googleusercontent.com
```

> `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_ID_WEB` are the **same web
> client ID**. The client ID is public (it ships in the browser bundle); there
> is no client *secret* in this flow.

Then: restart the API, and **rebuild** the web app (`npm run build:web` or
restart `npm run dev:web`) so the new `NEXT_PUBLIC_*` value is inlined.

### 1.3 Mobile native setup

- **Android**: register the Android OAuth client (§1.1b) in the *same* Google
  Cloud project as the web client. Then build/run passing the web client ID as
  the server client ID:

  ```
  flutter run --dart-define=GOOGLE_SERVER_CLIENT_ID=<web-client-id>.apps.googleusercontent.com
  ```

  (You can instead hardcode it in `ApiConstants.googleServerClientId` in
  `lib/core/utils/constants.dart` since it isn't a secret.)

- **iOS**: add the iOS OAuth client. Put the **reversed client ID** as a URL
  scheme in `ios/Runner/Info.plist` (or drop in `GoogleService-Info.plist`).
  The `google_sign_in` plugin requires this URL scheme to complete the flow.
  Pass the same `--dart-define=GOOGLE_SERVER_CLIENT_ID=...` so the returned ID
  token is audienced to the web client the backend expects.

### 1.4 Verify Google Sign-In

- Web: open `/login`, the real Google button renders (if the placeholder
  "Configure Google Sign-In" button shows, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is
  unset or the build wasn't refreshed). Click it, pick an account → you should
  land on the dashboard. First-ever sign-in auto-creates the account.
- Mobile: tap the Google button on the login screen → account picker → signed
  in. If you get "Could not retrieve Google ID Token", the native OAuth client
  (SHA-1 / bundle ID / URL scheme) or `serverClientId` isn't set up correctly.

---

## Part 2 — Razorpay (web)

### 2.1 Get API keys

1. Create/sign in at <https://dashboard.razorpay.com/>.
2. **Settings → API Keys → Generate Key**. You get a **Key ID**
   (`rzp_test_*` in test mode, `rzp_live_*` in live mode) and a **Key Secret**
   (shown once — store it safely).

### 2.2 Set the backend env vars

In the **root `.env`**:

```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=<your key secret>
```

- The **Key ID** is public — the backend returns it to the browser per order.
- The **Key Secret** is a true secret: server-side only, never exposed to the
  client, and never committed. **You must enter this value yourself.**

Restart the API after setting them.

### 2.3 Behaviour

- **Both set** → real Razorpay: `POST /api/v1/billing/.../order` creates a real
  order via Razorpay's API, the browser opens Razorpay Checkout with the
  returned `key_id`, and the verify endpoint checks the HMAC signature before
  granting the entitlement/booking.
- **Either missing** → simulated mode: a `sim_order_*` id is issued, checkout is
  auto-completed, and signature verification is skipped. This keeps dev/staging
  working without real money. It is **not** safe for production revenue —
  set real keys before going live.

### 2.4 Verify

Test mode uses Razorpay's test cards (e.g. card `4111 1111 1111 1111`, any
future expiry, any CVV). Buy a plan from `/pricing` (or book a mentor) → the
Razorpay modal opens → after a test payment the purchase/booking is marked
paid. Confirm in the Razorpay Dashboard (test mode) that the payment appears.

---

## Division of labour

**Done in code (this change set):**
- Mobile `serverClientId` wiring (`constants.dart`, `login_screen.dart`).
- Documented every required env var in `.env.example` and `apps/web/.env`.
- This guide.

**You must do (external accounts + secrets — cannot be done from code):**
- Create the Google Cloud OAuth clients (web/android/ios) and the Razorpay
  account/keys.
- Put the values into `.env` / `apps/web/.env`, add the mobile native OAuth
  clients (SHA-1 / bundle ID / URL scheme), and rebuild.
- In particular, enter the **Razorpay Key Secret** yourself — it must not be
  handled by tooling or committed to the repo.
