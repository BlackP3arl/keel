/** Emails that may read or write the desk. Override with ALLOWED_EMAILS (comma-separated). */
export const DEFAULT_ALLOWED_EMAIL = "salle.kma@gmail.com";

export function allowedEmails(raw = process.env.ALLOWED_EMAILS): string[] {
  const source = raw && raw.trim().length > 0 ? raw : DEFAULT_ALLOWED_EMAIL;
  return source
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

export function isAllowlisted(email: string | null | undefined, raw = process.env.ALLOWED_EMAILS): boolean {
  if (!email) return false;
  return allowedEmails(raw).includes(email.trim().toLowerCase());
}
