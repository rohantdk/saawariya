import { z } from "zod";

/**
 * Authentication input schemas.
 *
 * These run on the server inside Server Actions. Client-side validation is a
 * convenience for the user; this is the check that counts (SRS §193, §194).
 * Zod 4 syntax — note `z.email()` rather than the older `z.string().email()`.
 */

const indianMobile = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number.");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(/[a-zA-Z]/, "Password must contain a letter.")
  .regex(/[0-9]/, "Password must contain a number.");

export const loginSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Enter your full name.")
      .max(80, "Name is too long."),
    email: z.email("Enter a valid email address.").trim().toLowerCase(),
    mobile: indianMobile,
    password,
    confirmPassword: z.string(),
    customerType: z.enum(["RETAIL", "WHOLESALE"]).default("RETAIL"),
    gstNumber: z.string().trim().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  // Wholesale buyers are GST-registered businesses — SRS §21, §36.
  .refine(
    (data) => data.customerType !== "WHOLESALE" || Boolean(data.gstNumber),
    {
      message: "GST number is required for wholesale accounts.",
      path: ["gstNumber"],
    },
  );

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
});

export const verifyOtpSchema = z.object({
  target: z.string().trim().min(1),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code."),
  purpose: z.enum(["REGISTER", "LOGIN", "RESET_PASSWORD"]),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

/** Shape returned by every auth Server Action to `useActionState`. */
export type AuthFormState =
  | {
      errors?: Record<string, string[]>;
      message?: string;
    }
  | undefined;
