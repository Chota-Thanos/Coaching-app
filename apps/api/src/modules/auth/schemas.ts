import { z } from "zod";
import { listQuerySchema } from "../../common/http.js";

export const userRoleSchema = z.enum(["student", "admin", "moderator", "content_editor", "evaluator", "mentor"]);

export const registerSchema = z.object({
  email: z.string().trim().email(),
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string()
    .min(8)
    .max(200)
    .refine((val) => /[A-Z]/.test(val), "Password must contain at least one uppercase letter.")
    .refine((val) => /[a-z]/.test(val), "Password must contain at least one lowercase letter.")
    .refine((val) => /[0-9]/.test(val), "Password must contain at least one number.")
    .refine((val) => /[^A-Za-z0-9]/.test(val), "Password must contain at least one special character.")
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

export const googleLoginSchema = z.object({
  id_token: z.string().min(1)
});

export const listUsersQuerySchema = listQuerySchema.extend({
  role: userRoleSchema.optional(),
  is_active: z.coerce.boolean().optional(),
  search: z.string().trim().min(1).optional()
});

export const updateUserAdminSchema = z.object({
  email: z.string().trim().email().optional(),
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/).optional(),
  role: userRoleSchema.optional(),
  is_active: z.boolean().optional(),
  email_verified: z.boolean().optional()
});

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(16),
  password: z.string().min(8).max(200)
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8).max(200)
});

export const confirmEmailSchema = z.object({
  token: z.string().trim().min(16)
});

export type RequestPasswordResetInput = z.output<typeof requestPasswordResetSchema>;
export type ResetPasswordInput = z.output<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.output<typeof changePasswordSchema>;

export type UserRole = z.output<typeof userRoleSchema>;
export type RegisterInput = z.output<typeof registerSchema>;
export type LoginInput = z.output<typeof loginSchema>;
export type GoogleLoginInput = z.output<typeof googleLoginSchema>;
export type ListUsersQuery = z.output<typeof listUsersQuerySchema>;
export type UpdateUserAdminInput = z.output<typeof updateUserAdminSchema>;

export type AuthUser = {
  id: number;
  email: string;
  username: string;
  role: UserRole;
  is_active: boolean;
  /** Null until the address is confirmed. Surfaced so clients can prompt. */
  email_verified_at?: string | null;
};
