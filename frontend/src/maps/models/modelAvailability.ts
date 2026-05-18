export type ModelAvailabilityInput = {
  role?: string | null;
  is_available?: boolean | null;
};

function normalizeRole(role: unknown): string | undefined {
  if (typeof role !== "string") return undefined;
  const r = role.trim().toLowerCase();
  return r || undefined;
}

export function isFreeRole(role: unknown): boolean {
  return normalizeRole(role) === "free";
}

/**
 * Tek kaynak kural:
 * - role === "free" => her zaman kullanılabilir görünür
 * - aksi halde backend is_available gönderiyorsa onu kullan
 * - is_available yoksa geriye dönük davranış: kullanılabilir (true)
 */
export function computeIsAvailable(input: ModelAvailabilityInput): boolean {
  if (isFreeRole(input?.role)) return true;
  const v = input?.is_available;
  if (typeof v === "boolean") return v;
  return true;
}

