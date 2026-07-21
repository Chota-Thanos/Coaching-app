import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { config } from "../../config.js";
import { addCondition, addUpdate, requireUpdates } from "../../common/sql.js";
import { one, query } from "../../db.js";
import { hashPassword, verifyPassword } from "./password.js";
import type {
  AuthUser,
  ListUsersQuery,
  LoginInput,
  RegisterInput,
  UpdateUserAdminInput
} from "./schemas.js";

type UserRow = AuthUser & {
  password_hash: string;
};

function publicUser(row: UserRow | AuthUser): AuthUser {
  return {
    id: Number(row.id),
    email: row.email,
    username: row.username,
    role: row.role,
    is_active: row.is_active,
    email_verified_at: (row as AuthUser).email_verified_at ?? null
  };
}

export function signAccessToken(user: AuthUser): string {
  const options: SignOptions = {
    expiresIn: config.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    algorithm: "HS256"
  };

  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      username: user.username,
      role: user.role
    },
    config.JWT_SECRET,
    options
  );
}

export async function registerUser(input: RegisterInput): Promise<{ user: AuthUser; access_token: string }> {
  const activeUsers = await query<{ count: string }>(
    "select count(*)::text as count from app.users where is_active = true"
  );
  const isFirstActiveUser = Number(activeUsers[0]?.count ?? 0) === 0;
  const role = isFirstActiveUser ? "admin" : "student";
  const passwordHash = await hashPassword(input.password);

  const user = await one<UserRow>(
    `
      insert into app.users (email, username, password_hash, role)
      values ($1, $2, $3, $4)
      returning id, email, username, password_hash, role, is_active
    `,
    [input.email.toLowerCase(), input.username, passwordHash, role]
  );

  if (!user) throw new Error("User registration failed.");

  const safeUser = publicUser(user);
  return {
    user: safeUser,
    access_token: signAccessToken(safeUser)
  };
}

export async function loginUser(input: LoginInput): Promise<{ user: AuthUser; access_token: string }> {
  const user = await one<UserRow>(
    `
      select id, email, username, password_hash, role, is_active
      from app.users
      where email = $1
    `,
    [input.email.toLowerCase()]
  );

  if (!user || !user.is_active || !(await verifyPassword(input.password, user.password_hash))) {
    const error = new Error("Invalid email or password.") as Error & { statusCode?: number };
    error.statusCode = 401;
    throw error;
  }

  await query("update app.users set last_login_at = now() where id = $1", [user.id]);

  const safeUser = publicUser(user);
  return {
    user: safeUser,
    access_token: signAccessToken(safeUser)
  };
}

export async function getUserById(id: number): Promise<AuthUser | null> {
  const user = await one<AuthUser>(
    `
      select id, email, username, role, is_active, email_verified_at
      from app.users
      where id = $1
    `,
    [id]
  );

  return user ? publicUser(user) : null;
}

export async function listUsers(options: ListUsersQuery): Promise<AuthUser[]> {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (options.role) addCondition(conditions, params, "role = ?", options.role);
  if (options.is_active !== undefined) addCondition(conditions, params, "is_active = ?", options.is_active);
  if (options.search) {
    params.push(`%${options.search}%`);
    conditions.push(`(email ilike $${params.length} or username ilike $${params.length})`);
  }

  params.push(options.limit, options.offset);
  const limitPosition = params.length - 1;
  const offsetPosition = params.length;

  const users = await query<AuthUser>(
    `
      select id, email, username, role, is_active
      from app.users
      ${conditions.length ? `where ${conditions.join(" and ")}` : ""}
      order by created_at desc
      limit $${limitPosition} offset $${offsetPosition}
    `,
    params
  );

  return users.map(publicUser);
}

export async function updateUserAdmin(
  id: number,
  input: UpdateUserAdminInput,
  actorUserId: number
): Promise<AuthUser | null> {
  if (id === actorUserId && input.is_active === false) {
    const error = new Error("Admins cannot deactivate their own active account.") as Error & { statusCode?: number };
    error.statusCode = 409;
    throw error;
  }

  const params: unknown[] = [];
  const updates: string[] = [];

  addUpdate(updates, params, "email", input.email?.toLowerCase());
  addUpdate(updates, params, "username", input.username);
  addUpdate(updates, params, "role", input.role);
  addUpdate(updates, params, "is_active", input.is_active);
  if (input.email_verified !== undefined) {
    addUpdate(updates, params, "email_verified_at", input.email_verified ? new Date() : null);
  }
  requireUpdates(updates);

  params.push(id);
  const user = await one<AuthUser>(
    `
      update app.users
      set ${updates.join(", ")}, updated_at = now()
      where id = $${params.length}
      returning id, email, username, role, is_active
    `,
    params
  );

  return user ? publicUser(user) : null;
}

export function verifyAccessToken(token: string): { user_id: number } {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: ["HS256"] });
    if (!decoded || typeof decoded !== "object" || !("sub" in decoded)) {
      const error = new Error("Invalid token.") as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }
    return { user_id: Number(decoded.sub) };
  } catch (err: any) {
    const error = new Error(err.message || "Invalid or expired token.") as Error & { statusCode?: number };
    error.statusCode = 401;
    throw error;
  }
}

export async function loginOrRegisterGoogleUser(idToken: string): Promise<{ user: AuthUser; access_token: string }> {
  let payload: any;
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!response.ok) {
      throw new Error(`Google token validation failed: ${response.statusText}`);
    }
    payload = await response.json();
  } catch (err: any) {
    const error = new Error(`Invalid Google sign-in: ${err.message || err}`) as Error & { statusCode?: number };
    error.statusCode = 401;
    throw error;
  }

  const { email, email_verified, name, aud } = payload;

  // Google's tokeninfo endpoint returns email_verified as the STRING "true";
  // the decoded-JWT form uses a real boolean. Accept both. We only treat an
  // address as verified when Google actually vouches for it — previously this
  // field was read but never used, so every Google account was marked verified
  // regardless of what Google said.
  const googleEmailVerified = email_verified === true || email_verified === "true";

  if (!email) {
    const error = new Error("Google account email not found.") as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }

  // Validate the token's audience. Falling back to the project's public Web
  // client ID keeps this check ON by default: without it, a Google-issued token
  // minted for *any other* app could be replayed here to log in as that email.
  // Env vars still take precedence so another deployment can override them.
  const FALLBACK_GOOGLE_CLIENT_ID_WEB =
    "783135018669-i7qlooqlbaf7rjth2kb66c834eivl4s5.apps.googleusercontent.com";
  const googleClientIds = [
    config.GOOGLE_CLIENT_ID_WEB || FALLBACK_GOOGLE_CLIENT_ID_WEB,
    config.GOOGLE_CLIENT_ID_ANDROID,
    config.GOOGLE_CLIENT_ID_IOS
  ].filter(Boolean);

  if (googleClientIds.length > 0 && !googleClientIds.includes(aud)) {
    const error = new Error("Google authentication audience mismatch.") as Error & { statusCode?: number };
    error.statusCode = 401;
    throw error;
  }

  // Find user by email
  let user = await one<UserRow>(
    `
      select id, email, username, password_hash, role, is_active
      from app.users
      where email = $1
    `,
    [email.toLowerCase()]
  );

  if (!user) {
    // Register new user
    const activeUsers = await query<{ count: string }>(
      "select count(*)::text as count from app.users where is_active = true"
    );
    const isFirstActiveUser = Number(activeUsers[0]?.count ?? 0) === 0;
    const role = isFirstActiveUser ? "admin" : "student";

    // Generate unique username
    let baseUsername = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");
    if (baseUsername.length < 3) {
      baseUsername = "user_" + baseUsername;
    }
    baseUsername = baseUsername.substring(0, 40);

    let username = baseUsername;
    let isTaken = true;
    let attempts = 0;
    while (isTaken && attempts < 10) {
      const existing = await one("select id from app.users where username = $1", [username]);
      if (!existing) {
        isTaken = false;
      } else {
        username = `${baseUsername}_${Math.floor(100 + Math.random() * 900)}`;
        attempts++;
      }
    }

    user = await one<UserRow>(
      `
        insert into app.users (email, username, password_hash, role, email_verified_at)
        values ($1, $2, $3, $4, $5)
        returning id, email, username, password_hash, role, is_active, email_verified_at
      `,
      [email.toLowerCase(), username, "google-oauth", role, googleEmailVerified ? new Date() : null]
    );

    if (!user) {
      throw new Error("Failed to auto-register user from Google sign-in.");
    }
  } else {
    if (!user.is_active) {
      const error = new Error("User account is deactivated.") as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    }
    // Signing in with Google proves ownership of the address, so an existing
    // password-registered account gets verified for free here — no email sent.
    const refreshed = await one<{ email_verified_at: string | null }>(
      `update app.users
       set last_login_at = now(),
           email_verified_at = case
             when $2::boolean and email_verified_at is null then now()
             else email_verified_at
           end
       where id = $1
       returning email_verified_at`,
      [user.id, googleEmailVerified]
    );
    if (refreshed) user.email_verified_at = refreshed.email_verified_at;
  }

  const safeUser = publicUser(user);
  return {
    user: safeUser,
    access_token: signAccessToken(safeUser)
  };
}
