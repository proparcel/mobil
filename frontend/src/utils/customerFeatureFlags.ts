import type { CustomerFeatureFlags } from '../types/auth';

export function parseCustomerFeatureFlags(raw: unknown): CustomerFeatureFlags | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const flags: CustomerFeatureFlags = {};
  if (typeof obj.smart_query === 'boolean') flags.smart_query = obj.smart_query;
  if (typeof obj.quarter_verification === 'boolean') {
    flags.quarter_verification = obj.quarter_verification;
  }
  if (flags.smart_query === undefined && flags.quarter_verification === undefined) {
    return undefined;
  }
  return flags;
}
