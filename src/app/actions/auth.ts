"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword, dummyVerify } from "@/lib/auth/password";
import { createSession, destroySession, getSession } from "@/lib/auth/session";
import {
  loginSchema,
  registerSchema,
  type AuthFormState,
} from "@/lib/validations/auth";
import { ROLES, ROLE_HOME, USER_STATUS, type RoleCode } from "@/lib/constants";

/**
 * Only ever redirect to a path inside this application.
 *
 * The `next` parameter comes from the URL, so it is attacker-controlled. Without
 * this check, /login?next=https://evil.example turns our own login page into an
 * open redirect and a convincing phishing hop.
 */
function safeRedirectPath(candidate: string | undefined | null): string | null {
  if (!candidate) return null;
  if (!candidate.startsWith("/")) return null;
  // "//host" and "/\host" are protocol-relative URLs that leave the site.
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return null;
  return candidate;
}

async function requestContext() {
  const headerList = await headers();
  return {
    ipAddress:
      headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headerList.get("x-real-ip") ??
      null,
    userAgent: headerList.get("user-agent") ?? null,
  };
}

// ---------------------------------------------------------------------------
// LOGIN — SRS §37
// ---------------------------------------------------------------------------

export async function login(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { errors: z_flatten(parsed.error) };
  }

  const { email, password, next } = parsed.data;
  const { ipAddress, userAgent } = await requestContext();

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
      roleCode: true,
      status: true,
    },
  });

  // Run a dummy hash comparison when the account does not exist, so that
  // "no such user" and "wrong password" take a similar amount of time.
  // Otherwise response timing reveals which emails are registered.
  if (!user) {
    await dummyVerify();
    await prisma.loginEvent.create({
      data: { email, success: false, ipAddress, userAgent },
    });
    return { message: "Incorrect email or password." };
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);

  if (!passwordValid) {
    await prisma.loginEvent.create({
      data: { userId: user.id, email, success: false, ipAddress, userAgent },
    });
    // Deliberately identical to the message above — never disclose which half
    // of the credential pair was wrong.
    return { message: "Incorrect email or password." };
  }

  if (user.status === USER_STATUS.SUSPENDED) {
    await prisma.loginEvent.create({
      data: { userId: user.id, email, success: false, ipAddress, userAgent },
    });
    return {
      message:
        "This account has been suspended. Please contact Saawariya support.",
    };
  }

  await prisma.$transaction([
    prisma.loginEvent.create({
      data: { userId: user.id, email, success: true, ipAddress, userAgent },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
  ]);

  await createSession(user.id, user.roleCode as RoleCode);

  // redirect() throws internally, so it must be outside any try/catch.
  redirect(
    safeRedirectPath(next) ?? ROLE_HOME[user.roleCode as RoleCode] ?? "/",
  );
}

// ---------------------------------------------------------------------------
// REGISTER — SRS §21, §36
// ---------------------------------------------------------------------------

export async function register(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    mobile: formData.get("mobile"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    customerType: formData.get("customerType") ?? "RETAIL",
    gstNumber: formData.get("gstNumber") ?? undefined,
  });

  if (!parsed.success) {
    return { errors: z_flatten(parsed.error) };
  }

  const { fullName, email, mobile, password, customerType, gstNumber } =
    parsed.data;

  const [existingEmail, existingMobile] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.user.findUnique({ where: { mobile }, select: { id: true } }),
  ]);

  if (existingEmail) {
    return { errors: { email: ["An account with this email already exists."] } };
  }
  if (existingMobile) {
    return {
      errors: { mobile: ["An account with this mobile number already exists."] },
    };
  }

  const passwordHash = await hashPassword(password);

  // User and Customer are created together — a customer row without its user
  // (or the reverse) would be an unusable half-account.
  const user = await prisma.user.create({
    data: {
      email,
      mobile,
      fullName,
      passwordHash,
      roleCode: ROLES.CUSTOMER,
      status: USER_STATUS.ACTIVE,
      customer: {
        create: {
          customerType,
          gstNumber: customerType === "WHOLESALE" ? gstNumber : null,
        },
      },
      notifications: {
        create: {
          title: "Welcome to Saawariya",
          body: "Your account is ready. Explore our collections of handwoven textiles.",
          category: "SYSTEM",
          linkUrl: "/shop",
        },
      },
    },
    select: { id: true, roleCode: true },
  });

  await createSession(user.id, user.roleCode as RoleCode);

  redirect(ROLE_HOME[user.roleCode as RoleCode] ?? "/account");
}

// ---------------------------------------------------------------------------
// LOGOUT
// ---------------------------------------------------------------------------

export async function logout(): Promise<void> {
  const session = await getSession();

  if (session?.userId) {
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "USER_LOGGED_OUT",
        entityType: "User",
        entityId: session.userId,
        summary: "User signed out",
      },
    });
  }

  await destroySession();
  redirect("/login");
}

/**
 * Zod 4 removed `error.flatten()`. This reproduces the field-error shape that
 * `useActionState` consumers expect: { fieldName: ["message", ...] }.
 */
function z_flatten(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (result[key] ??= []).push(issue.message);
  }
  return result;
}
