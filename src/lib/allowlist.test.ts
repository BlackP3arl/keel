import { afterEach, describe, expect, it } from "vitest";
import { allowedEmails, DEFAULT_ALLOWED_EMAIL, isAllowlisted } from "@/lib/allowlist";

describe("allowlist", () => {
  afterEach(() => {
    delete process.env.ALLOWED_EMAILS;
  });

  it("seeds salle.kma@gmail.com when ALLOWED_EMAILS is unset", () => {
    expect(allowedEmails(undefined)).toEqual([DEFAULT_ALLOWED_EMAIL]);
    expect(isAllowlisted("salle.kma@gmail.com", undefined)).toBe(true);
    expect(isAllowlisted("SALLE.KMA@GMAIL.COM", undefined)).toBe(true);
  });

  it("reads a comma-separated override", () => {
    const raw = "owner@example.com, other@example.com";
    expect(allowedEmails(raw)).toEqual(["owner@example.com", "other@example.com"]);
    expect(isAllowlisted("other@example.com", raw)).toBe(true);
    expect(isAllowlisted("salle.kma@gmail.com", raw)).toBe(false);
  });

  it("rejects missing emails", () => {
    expect(isAllowlisted(null, undefined)).toBe(false);
    expect(isAllowlisted("", undefined)).toBe(false);
  });
});
