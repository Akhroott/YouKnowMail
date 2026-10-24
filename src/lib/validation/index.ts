import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

export const twoFactorSchema = z.object({
  code: z
    .string()
    .min(6, "Enter a 6-digit code")
    .max(8, "Code is too long")
    .regex(/^[A-Za-z0-9-]+$/, "Invalid code format"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(10, "Password must be at least 10 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[a-z]/, "Include at least one lowercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const invitationPasswordSchema = z
  .object({
    password: z
      .string()
      .min(10, "Password must be at least 10 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[a-z]/, "Include at least one lowercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/** Unified account creation — POST /admin/accounts */
export const createAccountSchema = z
  .object({
    username: z
      .string()
      .min(2, "Username must be at least 2 characters")
      .max(64, "Username is too long")
      .regex(
        /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/,
        "Use lowercase letters, numbers, dots, hyphens, or underscores"
      ),
    password: z
      .string()
      .min(10, "Password must be at least 10 characters")
      .max(256, "Password is too long"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    displayName: z.string().max(128, "Display name is too long").optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const preferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
  dateTimeFormat: z.enum(["relative", "absolute"]),
  inboxDensity: z.enum(["comfortable", "compact"]),
  showImages: z.boolean(),
  markReadOnOpen: z.boolean(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type TwoFactorFormValues = z.infer<typeof twoFactorSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
export type InvitationPasswordFormValues = z.infer<typeof invitationPasswordSchema>;
/** Bulk unified accounts — POST /admin/accounts/bulk */
export const bulkCreateAccountsSchema = z
  .object({
    prefix: z
      .string()
      .min(1, "Prefix is required")
      .max(48, "Prefix is too long")
      .regex(
        /^[a-z0-9][a-z0-9._-]*$/,
        "Use lowercase letters, numbers, dots, hyphens, or underscores"
      ),
    count: z.number().int().min(1).max(100),
    startIndex: z.number().int().min(0).max(999999),
    padWidth: z.number().int().min(1).max(8),
    useRandom: z.boolean(),
    passwordMode: z.enum(["shared", "generate"]),
    password: z.string().max(256).optional(),
    confirmPassword: z.string().optional(),
    displayNamePrefix: z.string().max(64).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.passwordMode === "shared") {
      if (!data.password || data.password.length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Password must be at least 10 characters",
          path: ["password"],
        });
      }
      if (data.password !== data.confirmPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Passwords do not match",
          path: ["confirmPassword"],
        });
      }
    }
  });

export const setAccountPasswordSchema = z
  .object({
    password: z
      .string()
      .min(10, "Password must be at least 10 characters")
      .max(256, "Password is too long"),
    confirmPassword: z.string().min(1, "Confirm the password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type CreateAccountFormValues = z.infer<typeof createAccountSchema>;
export type BulkCreateAccountsFormValues = z.infer<typeof bulkCreateAccountsSchema>;
export type SetAccountPasswordFormValues = z.infer<typeof setAccountPasswordSchema>;
export type PreferencesFormValues = z.infer<typeof preferencesSchema>;
