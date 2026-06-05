import type { User } from "../types/auth";
import { isPlatformAdmin } from "./membership";

/** Mobil uygulamada admin panel erişimi (menü + hub). */
export function isAppAdminUser(user?: User | Record<string, unknown> | null): boolean {
  return isPlatformAdmin(user as User | null | undefined);
}
