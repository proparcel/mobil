/**
 * İlan self API — /api/v1/self/listings/...
 */

export type ListingDraftCreateData = {
  listing_id: string;
  workflow_status?: string;
  publication_status?: string;
  version?: number;
  current_step?: string;
};

export type ListingDraftCreateEnvelope = {
  data: ListingDraftCreateData;
  meta?: Record<string, unknown>;
};

export type MineListingRow = {
  listing_id: string;
  title?: string | null;
  publication_status?: string | null;
  workflow_status?: string | null;
  current_step?: string | null;
  updated_at?: string | null;
  published_at?: string | null;
  price_amount?: number | null;
  currency?: string | null;
  cover_image_url?: string | null;
  thumb_url?: string | null;
  version?: number | null;
  /** Detay sayfası görüntülenme (yayında, sahibi dışı) */
  detail_view_count_total?: number | null;
  favorite_count_total?: number | null;
  /** Portal puanlama — olumlu oy (beğeni) */
  rating_success_count?: number | null;
  comment_count?: number | null;
};

export type ListingMineEnvelope = {
  items: MineListingRow[];
  meta?: Record<string, unknown>;
};
