/** İlan sihirbazı — web wizardConfig.js ile uyumlu adım anahtarları */

export type ListingWizardStepKey =
  | "eids_authorization"
  | "category_selection"
  | "core_details"
  | "location"
  | "dynamic_attributes"
  | "media"
  | "description"
  | "preview"
  | "visibility_confirmation"
  | "publish";

export type ListingWizardMode = "create" | "edit";

export type ListingMediaItem = {
  media_id?: string;
  url?: string;
  sort_order?: number;
  thumb_url?: string;
};

export type ListingEidsAuthorization = {
  status?: string;
  tasinmaz_id?: string;
  il?: string;
  ilce?: string;
  mahalle?: string;
  ada?: string;
  parsel?: string;
  authorized_at?: string;
  test_bypass?: boolean;
};

export type ListingWizardContent = {
  title?: string | null;
  listing_type?: "sale" | "rent" | string | null;
  currency?: string | null;
  price_amount?: number | null;
  category_leaf_id?: string | null;
  category_breadcrumb?: Array<{ id?: string; label?: string }> | string[] | null;
  ada?: string | null;
  parsel?: string | null;
  city_id?: string | null;
  district_id?: string | null;
  quarter_id?: string | null;
  proparcel_value?: number | null;
  mahalle_tkgm_value?: string | null;
  location_resolved?: boolean | null;
  location_labels?: Record<string, unknown> | null;
  area_m2?: number | null;
  listing_attributes?: Record<string, unknown> | null;
  listing_media?: ListingMediaItem[] | null;
  description?: string | null;
  portal_visibility?: "public" | "vault" | string | null;
  eids_tasinmaz_id?: string | null;
  eids_authorization?: ListingEidsAuthorization | null;
  portal_origin_snapshot_id?: number | null;
  version?: number;
};

export type ListingWizardState = {
  listing_id: string;
  current_step: ListingWizardStepKey | string;
  version: number;
  content?: ListingWizardContent;
  workflow_status?: string;
  publication_status?: string;
};

export type ListingWizardForm = {
  eidsTasinmazId: string;
  eidsAuthorization: ListingEidsAuthorization | null;
  categoryLeafId: string;
  categoryBreadcrumbLabels: string[];
  title: string;
  listingType: "sale" | "rent";
  currency: string;
  priceAmount: string;
  ada: string;
  parsel: string;
  cityId: string;
  districtId: string;
  quarterId: string;
  proparcelValue: string;
  mahalleTkgmValue: string;
  areaM2: string;
  locationLabels: Record<string, string>;
  listingAttributes: Record<string, unknown>;
  listingMedia: ListingMediaItem[];
  description: string;
  portalVisibility: "public" | "vault";
};

export type EidsStatusPayload = {
  enabled?: boolean;
  configured?: boolean;
  authenticated?: boolean;
  user?: { ad?: string; soyad?: string } | null;
  listing_authorization?: ListingEidsAuthorization | null;
};

export const EMPTY_LISTING_WIZARD_FORM: ListingWizardForm = {
  eidsTasinmazId: "",
  eidsAuthorization: null,
  categoryLeafId: "",
  categoryBreadcrumbLabels: [],
  title: "",
  listingType: "sale",
  currency: "TRY",
  priceAmount: "",
  ada: "",
  parsel: "",
  cityId: "",
  districtId: "",
  quarterId: "",
  proparcelValue: "",
  mahalleTkgmValue: "",
  areaM2: "",
  locationLabels: {},
  listingAttributes: {},
  listingMedia: [],
  description: "",
  portalVisibility: "public",
};
