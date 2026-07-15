import type { FastifyRequest } from "fastify";
import { getUserById, verifyAccessToken } from "./service.js";
import type { AuthUser, UserRole } from "./schemas.js";

function unauthorized(message = "Authentication required."): never {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = 401;
  throw error;
}

function forbidden(message = "Permission denied."): never {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = 403;
  throw error;
}

export async function requireAuth(request: FastifyRequest): Promise<AuthUser> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) unauthorized();

  const token = authHeader.slice("Bearer ".length).trim();
  const payload = verifyAccessToken(token);
  const user = await getUserById(payload.user_id);

  if (!user || !user.is_active) unauthorized();
  return user;
}

/** Same as requireAuth, but returns null instead of throwing when there's no valid session. */
export async function getOptionalAuth(request: FastifyRequest): Promise<AuthUser | null> {
  try {
    return await requireAuth(request);
  } catch {
    return null;
  }
}

/** Opaque client-generated guest identity, used to let unauthenticated visitors take a
 * test attempt that gets claimed into their account once they register/log in. */
export function getGuestToken(request: FastifyRequest): string | null {
  const header = request.headers["x-guest-token"];
  const value = Array.isArray(header) ? header[0] : header;
  return value && value.trim().length > 0 ? value.trim() : null;
}

export async function requireRole(request: FastifyRequest, allowedRoles: UserRole[]): Promise<AuthUser> {
  const user = await requireAuth(request);
  if (!allowedRoles.includes(user.role)) forbidden();
  return user;
}

export async function requireAdminOrEditor(request: FastifyRequest): Promise<AuthUser> {
  return requireRole(request, ["admin", "moderator", "content_editor"]);
}

export async function requireEvaluator(request: FastifyRequest): Promise<AuthUser> {
  return requireRole(request, ["admin", "moderator", "evaluator", "mentor"]);
}

