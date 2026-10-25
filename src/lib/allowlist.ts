/** Bootstrap admin emails. Override with ALLOWED_EMAILS (comma-separated). Always admin; cannot be locked out. */
export const DEFAULT_ALLOWED_EMAIL = "salle.kma@gmail.com";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function allowedEmails(raw = process.env.ALLOWED_EMAILS): string[] {
  const source = raw && raw.trim().length > 0 ? raw : DEFAULT_ALLOWED_EMAIL;
  return source
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter((email) => email.length > 0);
}

export function isBootstrapAdmin(email: string | null | undefined, raw = process.env.ALLOWED_EMAILS): boolean {
  if (!email) return false;
  return allowedEmails(raw).includes(normalizeEmail(email));
}

/** @deprecated Use isAuthorized / resolveAccess. Kept for tests that check the env bootstrap list. */
export function isAllowlisted(email: string | null | undefined, raw = process.env.ALLOWED_EMAILS): boolean {
  return isBootstrapAdmin(email, raw);
}
