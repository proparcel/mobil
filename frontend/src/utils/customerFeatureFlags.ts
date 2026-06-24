import type { CustomerFeatureFlags } from '../types/auth';

export function parseCustomerFeatureFlags(raw: unknown): CustomerFeatureFlags | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.smart_query !== 'boolean') return undefined;
  return { smart_query: obj.smart_query };
}
