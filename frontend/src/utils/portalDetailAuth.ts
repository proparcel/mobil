/**
 * Portal sorgu / ilan detayı — giriş yönlendirmesi ve oturum kontrolü.
 */

export type PortalDetailLoginReturnParams = {
  returnScreen: 'son-30-gun-detay';
  snapshotId: string;
  listingId?: string;
  commentId?: string;
  ratingId?: string;
  fromProQuery?: string;
};

export function isPortalAuthRequired(status?: number, error?: string | null): boolean {
  if (status === 401) return true;
  const msg = String(error ?? '').toLowerCase();
  return msg.includes('authentication required');
}

export function isPortalRateLimited(status?: number, error?: string | null): boolean {
  if (status === 429) return true;
  const msg = String(error ?? '').toLowerCase();
  return msg.includes('çok fazla istek') || msg.includes('too many');
}

export function buildPortalDetailLoginReturn(input: {
  snapshotId: number;
  listingId?: string;
  commentId?: string;
  ratingId?: string;
  fromProQuery?: string;
}): PortalDetailLoginReturnParams {
  const params: PortalDetailLoginReturnParams = {
    returnScreen: 'son-30-gun-detay',
    snapshotId: String(input.snapshotId),
  };
  const lid = String(input.listingId ?? '').trim();
  if (lid) params.listingId = lid;
  if (input.commentId) params.commentId = input.commentId;
  if (input.ratingId) params.ratingId = input.ratingId;
  if (input.fromProQuery) params.fromProQuery = input.fromProQuery;
  return params;
}

export function parsePortalDetailLoginReturn(
  params: Record<string, string | undefined>,
): PortalDetailLoginReturnParams | null {
  if (params.returnScreen !== 'son-30-gun-detay') return null;
  const snapshotId = String(params.snapshotId ?? '').trim();
  if (!snapshotId) return null;
  const out: PortalDetailLoginReturnParams = {
    returnScreen: 'son-30-gun-detay',
    snapshotId,
  };
  const listingId = String(params.listingId ?? '').trim();
  if (listingId) out.listingId = listingId;
  if (params.commentId) out.commentId = params.commentId;
  if (params.ratingId) out.ratingId = params.ratingId;
  if (params.fromProQuery) out.fromProQuery = params.fromProQuery;
  return out;
}
