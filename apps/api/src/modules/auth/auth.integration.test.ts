import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../../server.js";
import { closePool, one, query } from "../../db.js";
import { config } from "../../config.js";

let server: FastifyInstance;
const originalFetch = globalThis.fetch;
const testEmail = `auth-test-${Date.now()}@example.test`;
const testUsername = `testuser_${Date.now()}`;
const testPassword = "Password123!";

before(async () => {
  server = await buildServer();
  
  // Set google client ID configurations for testing audience checks
  config.GOOGLE_CLIENT_ID_WEB = "test-web-client-id";
  config.GOOGLE_CLIENT_ID_ANDROID = "test-android-client-id";
  config.GOOGLE_CLIENT_ID_IOS = "test-ios-client-id";

  // Mock global fetch for Google token verification
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = url.toString();
    if (urlStr.includes("oauth2.googleapis.com/tokeninfo")) {
      const parsedUrl = new URL(urlStr);
      const idToken = parsedUrl.searchParams.get("id_token");

      if (idToken === "valid-token-web") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            email: "google-auth-test@example.test",
            email_verified: "true",
            name: "Google Test User",
            aud: "test-web-client-id",
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
            aud: "wrong-client-id",
            sub: "google-uid-mismatch"
          })
        } as Response;
      }

      if (idToken === "invalid-token") {
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
});

after(async () => {
  // Restore configurations and fetch mock
  config.GOOGLE_CLIENT_ID_WEB = undefined;
  config.GOOGLE_CLIENT_ID_ANDROID = undefined;
  config.GOOGLE_CLIENT_ID_IOS = undefined;
  globalThis.fetch = originalFetch;

  // Cleanup database test users
  await query("delete from app.users where email in ($1, $2, $3)", [
    testEmail,
    "google-auth-test@example.test",
    "mismatched-aud@example.test"
  ]);

  await server.close();
  await closePool();
});

test("Standard Registration & Password Login Flow", async (t) => {
  await t.test("Register a new user successfully", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: testEmail,
        username: testUsername,
        password: testPassword
      }
    });

    assert.equal(response.statusCode, 201);
    const json = response.json();
    assert.ok(json.access_token);
    assert.equal(json.user.email, testEmail);
    assert.equal(json.user.username, testUsername);
    assert.equal(json.user.role, "student");
  });

  await t.test("Fail to register with duplicate email", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: testEmail,
        username: `${testUsername}_dup`,
        password: testPassword
      }
    });

    // Expecting 400 or 500 database error code indicating conflict
    assert.ok(response.statusCode >= 400);
  });

  await t.test("Login with correct credentials", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: testEmail,
        password: testPassword
      }
    });

    assert.equal(response.statusCode, 200);
    const json = response.json();
    assert.ok(json.access_token);
    assert.equal(json.user.email, testEmail);
  });

  await t.test("Fail to login with incorrect password", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: testEmail,
        password: "WrongPassword1!"
      }
    });

    assert.equal(response.statusCode, 401);
  });

  await t.test("Fetch authenticated me route profile details", async () => {
    const loginResponse = await server.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: testEmail,
        password: testPassword
      }
    });
    const token = loginResponse.json().access_token;

    const meResponse = await server.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(meResponse.statusCode, 200);
    const profile = meResponse.json();
    assert.equal(profile.email, testEmail);
    assert.equal(profile.username, testUsername);
  });
});

test("Google Sign-In Flow", async (t) => {
  await t.test("Auto-register and login new user via Google ID Token", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/v1/auth/google",
      payload: {
        id_token: "valid-token-web"
      }
    });

    assert.equal(response.statusCode, 200);
    const json = response.json();
    assert.ok(json.access_token);
    assert.equal(json.user.email, "google-auth-test@example.test");
    assert.equal(json.user.role, "student");
    assert.ok(json.user.username.startsWith("googleauthtest"));

    // Verify password hash in DB is 'google-oauth'
    const dbUser = await one<{ password_hash: string }>(
      "select password_hash from app.users where email = $1",
      ["google-auth-test@example.test"]
    );
    assert.equal(dbUser?.password_hash, "google-oauth");
  });

  await t.test("Log in existing Google user successfully on subsequent sign-in", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/v1/auth/google",
      payload: {
        id_token: "valid-token-web"
      }
    });

    assert.equal(response.statusCode, 200);
    const json = response.json();
    assert.ok(json.access_token);
    assert.equal(json.user.email, "google-auth-test@example.test");
  });

  await t.test("Fail with audience mismatch", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/v1/auth/google",
      payload: {
        id_token: "mismatched-aud-token"
      }
    });

    assert.equal(response.statusCode, 401);
    assert.ok(response.json().message.includes("audience mismatch"));
  });

  await t.test("Fail with invalid token", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/v1/auth/google",
      payload: {
        id_token: "invalid-token"
      }
    });

    assert.equal(response.statusCode, 401);
    assert.ok(response.json().message.includes("validation failed"));
  });
});
