import "server-only";
import bcrypt from "bcryptjs";

/**
 * Password hashing.
 *
 * bcrypt with a work factor of 12. Plaintext passwords are never stored, never
 * logged, and never returned from the data access layer — see src/lib/dal.ts,
 * where every user query selects columns explicitly rather than returning the
 * whole row (SRS §179 secure password storage, §194).
 */
const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Constant-ish-time dummy comparison.
 *
 * Called when a login is attempted for an email that does not exist, so that a
 * missing account and a wrong password take roughly the same time to fail.
 * Without this, response timing leaks which email addresses are registered.
 */
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.uQXqvLbMFtL9K2/YR9zSJvfTBLLFn8y";

export async function dummyVerify(): Promise<void> {
  await bcrypt.compare("dummy-password-for-timing", DUMMY_HASH);
}
