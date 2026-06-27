import assert from "node:assert/strict";
import { query, one, closePool } from "./db.js";
import { buildServer } from "./server.js";
import { config } from "./config.js";

async function main() {
  console.log("==================================================");
  console.log("🔐 STARTING AUTHENTICATION & VERIFICATION TEST FLOW");
  console.log("==================================================\n");

  // Save original fetch
  const originalFetch = globalThis.fetch;
  
  // Set test credentials
  const testEmail = `auth-test-${Date.now()}@example.test`;
  const testUsername = `user_${Date.now()}`;
  const testPassword = "SecurePassword123!";
  const googleEmail = `google-auth-test-${Date.now()}@example.test`;

  // Set mock Google Client IDs
  config.GOOGLE_CLIENT_ID_WEB = "mock-web-client-id";
  config.GOOGLE_CLIENT_ID_ANDROID = "mock-android-client-id";
  config.GOOGLE_CLIENT_ID_IOS = "mock-ios-client-id";

  // Mock Google public OAuth tokeninfo endpoint
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = url.toString();
    if (urlStr.includes("oauth2.googleapis.com/tokeninfo")) {
      const parsedUrl = new URL(urlStr);
      const idToken = parsedUrl.searchParams.get("id_token");

      if (idToken === "valid-google-token-web") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            email: googleEmail,
            email_verified: "true",
            name: "Google Test User",
            aud: "mock-web-client-id",
            sub: "google-uid-web-123"
          })
        } as Response;
      }

      if (idToken === "mismatched-aud-token") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            email: "mismatched-aud@example.test",
            email_verified: "true",
            name: "Mismatched User",
            aud: "wrong-client-id-hacker",
            sub: "google-uid-mismatch"
          })
        } as Response;
      }

      if (idToken === "invalid-google-token") {
        return {
          ok: false,
          status: 400,
          statusText: "Bad Request",
          json: async () => ({
            error_description: "Invalid Value"
          })
        } as Response;
      }
    }
    return originalFetch(url, init);
  }) as typeof globalThis.fetch;

  let server;
  try {
    server = await buildServer();
    console.log("📦 Server built successfully. Starting test cases...\n");

    // ----------------------------------------------------
    // TEST 1: Register User
    // ----------------------------------------------------
    console.log("👉 [Test 1] Registering a new user via standard credentials...");
    const regRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: testEmail,
        username: testUsername,
        password: testPassword
      }
    });

    assert.equal(regRes.statusCode, 201, `Failed registration: ${regRes.payload}`);
    const regPayload = regRes.json();
    assert.ok(regPayload.access_token, "No access token returned on registration.");
    assert.equal(regPayload.user.email, testEmail);
    assert.equal(regPayload.user.username, testUsername);
    console.log(`✅ User registered successfully! ID: ${regPayload.user.id}, Role: ${regPayload.user.role}`);

    // ----------------------------------------------------
    // TEST 2: Duplicate Email Rejection
    // ----------------------------------------------------
    console.log("\n👉 [Test 2] Verifying duplicate email rejection...");
    const dupRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: testEmail,
        username: `${testUsername}_dup`,
        password: testPassword
      }
    });

    assert.ok(dupRes.statusCode === 409 || dupRes.statusCode === 400, `Expected conflict/validation error, got ${dupRes.statusCode}`);
    console.log(`✅ Duplicate registration blocked successfully (Status Code: ${dupRes.statusCode})`);

    // ----------------------------------------------------
    // TEST 3: Login User
    // ----------------------------------------------------
    console.log("\n👉 [Test 3] Verifying standard login with correct credentials...");
    const loginRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: testEmail,
        password: testPassword
      }
    });

    assert.equal(loginRes.statusCode, 200);
    const loginPayload = loginRes.json();
    assert.ok(loginPayload.access_token, "No access token returned on login.");
    console.log("✅ Logged in successfully!");

    // ----------------------------------------------------
    // TEST 4: Invalid Password Rejection
    // ----------------------------------------------------
    console.log("\n👉 [Test 4] Verifying login fails with incorrect password...");
    const badLoginRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: testEmail,
        password: "WrongPassword!"
      }
    });

    assert.equal(badLoginRes.statusCode, 401);
    console.log("✅ Invalid credentials rejected successfully.");

    // ----------------------------------------------------
    // TEST 5: Authenticated Session Profile (/me)
    // ----------------------------------------------------
    console.log("\n👉 [Test 5] Verifying access to protected route (/me) using JWT...");
    const meRes = await server.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        authorization: `Bearer ${loginPayload.access_token}`
      }
    });

    assert.equal(meRes.statusCode, 200);
    const mePayload = meRes.json();
    assert.equal(mePayload.email, testEmail);
    assert.equal(mePayload.username, testUsername);
    console.log("✅ Protected route session verified successfully!");

    // ----------------------------------------------------
    // TEST 6: Google OAuth Auto-Registration
    // ----------------------------------------------------
    console.log("\n👉 [Test 6] Verifying Google OAuth login (new user registration)...");
    const googleRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/google",
      payload: {
        id_token: "valid-google-token-web"
      }
    });

    assert.equal(googleRes.statusCode, 200, `Google login failed: ${googleRes.payload}`);
    const googlePayload = googleRes.json();
    assert.ok(googlePayload.access_token, "No access token returned for Google OAuth user.");
    const googleEmail = googlePayload.user.email;
    assert.ok(googleEmail.endsWith("@example.test"), "Invalid email parsed.");
    console.log(`✅ Google user auto-registered & logged in successfully! Email: ${googleEmail}`);

    // Verify DB states for Google user
    const googleDbUser = await one<{ password_hash: string; email_verified_at: string }>(
      "select password_hash, email_verified_at::text from app.users where email = $1",
      [googleEmail]
    );
    assert.equal(googleDbUser?.password_hash, "google-oauth", "Expected Google OAuth password hash placeholder.");
    assert.ok(googleDbUser?.email_verified_at, "Google user should be marked as email-verified immediately.");
    console.log("🔹 Verified database states: password_hash = 'google-oauth', email_verified_at is populated.");

    // ----------------------------------------------------
    // TEST 7: Google OAuth Duplicate Sign-In (Existing User)
    // ----------------------------------------------------
    console.log("\n👉 [Test 7] Verifying subsequent sign-in of same Google user...");
    const googleLoginRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/google",
      payload: {
        id_token: "valid-google-token-web"
      }
    });

    assert.equal(googleLoginRes.statusCode, 200);
    const googleLoginPayload = googleLoginRes.json();
    assert.equal(googleLoginPayload.user.email, googleEmail);
    console.log("✅ Existing Google user logged in successfully without duplication.");

    // ----------------------------------------------------
    // TEST 8: Google OAuth Client ID Audience Check Protection
    // ----------------------------------------------------
    console.log("\n👉 [Test 8] Verifying audience mismatch protection...");
    const mismatchRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/google",
      payload: {
        id_token: "mismatched-aud-token"
      }
    });

    assert.equal(mismatchRes.statusCode, 401);
    console.log("✅ Audience mismatch correctly blocked (Hacker client IDs rejected).");

    // ----------------------------------------------------
    // TEST 9: Google OAuth Invalid Token Check Protection
    // ----------------------------------------------------
    console.log("\n👉 [Test 9] Verifying invalid/expired token protection...");
    const invalidTokenRes = await server.inject({
      method: "POST",
      url: "/api/v1/auth/google",
      payload: {
        id_token: "invalid-google-token"
      }
    });

    assert.equal(invalidTokenRes.statusCode, 401);
    console.log("✅ Invalid/expired tokens correctly blocked.");

    // ----------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------
    console.log("\n🧹 Cleaning up test database users...");
    await query("delete from app.users where email in ($1, $2, 'mismatched-aud@example.test')", [
      testEmail,
      googleEmail
    ]);
    console.log("✅ DB cleaned up successfully.");

    console.log("\n==================================================");
    console.log("🏁 ALL AUTHENTICATION AND VERIFICATION TESTS PASSED!");
    console.log("==================================================");

  } catch (error) {
    console.error("\n❌ Test execution failed:", error);
    process.exitCode = 1;
  } finally {
    // Restore global fetch and configurations
    globalThis.fetch = originalFetch;
    config.GOOGLE_CLIENT_ID_WEB = undefined;
    config.GOOGLE_CLIENT_ID_ANDROID = undefined;
    config.GOOGLE_CLIENT_ID_IOS = undefined;

    if (server) {
      await server.close();
    }
    await closePool();
  }
}

main().catch(console.error);
