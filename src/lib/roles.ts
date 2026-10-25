export type AppRole = "admin" | "viewer";

export const APP_ROLES: AppRole[] = ["admin", "viewer"];

export const APP_ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  viewer: "Viewer",
};

export function isAppRole(value: unknown): value is AppRole {
  return value === "admin" || value === "viewer";
}
