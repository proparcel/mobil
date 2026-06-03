import type { User } from "../types/auth";

/** Mobil uygulamada admin panel erişimi (menü + hub). */
export function isAppAdminUser(user?: User | Record<string, unknown> | null): boolean {
  if (!user) return false;
  if (user.is_admin === true) return true;
  const role = String(user.role || "").trim().toLowerCase();
  if (role === "admin") return true;
  if (user.is_staff === true || user.is_superuser === true) return true;
  return false;
}
