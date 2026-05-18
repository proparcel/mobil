/**
 * Web `SocialMediaTemplateApp.jsx` ile uyumlu alan çıkarımı (sosyal şablon).
 */

const QUERY_TYPE_LABELS: Record<string, string> = {
  arsa: "Arsa",
  tarla: "Tarla",
  villa: "Villa",
  fabrika: "Fabrika",
  bina: "Bina",
  konut: "Konut",
  mustakil_ev: "Müstakil Ev",
};

export type SocialFormState = {
  companyName: string;
  listingTitle: string;
  propertyType: string;
  city: string;
  district: string;
  neighborhood: string;
  price: string;
  priceCurrency: string;
  areaM2: string;
  ctaText: string;
};

export type EditableAdjustment = { x: number; y: number; fontSize: number };

export const TEMPLATE_OPTIONS = [
  { id: "default" as const, previewLabel: "Mavi", path: "/media/vitrin/mavi_sablon.png" },
  { id: "gold" as const, previewLabel: "Altın", path: "/media/vitrin/altin_sablon.png" },
  { id: "green" as const, previewLabel: "Yeşil", path: "/media/vitrin/yesil_sablon.png" },
];

export const EDITABLE_OVERLAY_ITEMS = [
  { id: "avatar", label: "Avatar", supportsFontSize: false },
  { id: "companyName", label: "Firma Adı", supportsFontSize: true },
  { id: "contactLine", label: "İsim ve Telefon", supportsFontSize: true },
  { id: "title", label: "İlan Başlığı", supportsFontSize: true },
  { id: "price", label: "Fiyat", supportsFontSize: true },
  { id: "area", label: "m²", supportsFontSize: true },
  { id: "location", label: "Mahalle", supportsFontSize: true },
] as const;

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function parseDisplayLabel(displayLabel: unknown): { city?: string; district?: string; neighborhood?: string } {
  const parts = normalizeText(displayLabel)
    .split("/")
    .map((item) => item.trim())
    .filter(Boolean);
  if (parts.length < 3) return {};
  const [city, district, neighborhood] = parts;
  return { city, district, neighborhood };
}

function resolveLocationFields(source: Record<string, unknown> | null | undefined) {
  const labels = (source?.location_labels as Record<string, unknown> | undefined) || {};
  const fromDisplayLabel = parseDisplayLabel(
    source?.display_label ?? labels?.display_label,
  );
  const city = normalizeText(
    labels.il ?? labels.city_name ?? fromDisplayLabel.city ?? source?.city_display_name ?? source?.city_name,
  );
  const district = normalizeText(
    labels.ilce ??
      source?.district_display_name ??
      labels.district_name ??
      fromDisplayLabel.district ??
      source?.district_name ??
      source?.district,
  );
  const town = normalizeText(source?.town_name);
  const quarter = normalizeText(labels.quarter_name ?? source?.quarter_name ?? source?.neighborhood_name);
  const districtOrTown =
    district ||
    (town && town !== quarter ? String(source?.town_name) : "");
  const neighborhood = normalizeText(
    labels.mahalle ??
      source?.quarter_display_name ??
      labels.quarter_name ??
      fromDisplayLabel.neighborhood ??
      source?.quarter_name ??
      source?.neighborhood_name ??
      source?.neighborhood,
  );
  return { city, district: districtOrTown, neighborhood };
}

export function formatPriceText(value: unknown, currency = "TL"): string {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    const c = normalizeText(currency).toUpperCase() === "TRY" ? "TL" : normalizeText(currency) || "TL";
    return `${numeric.toLocaleString("tr-TR")} ${c}`.trim();
  }
  return normalizeText(value);
}

export function formatAreaText(value: unknown): string {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(numeric)} m²`;
  }
  return normalizeText(value);
}

function inferPropertyType(summaryLike: Record<string, unknown>): string {
  const leaf = normalizeText(summaryLike?.listing_category_leaf_label);
  if (leaf) return leaf;
  const qt = normalizeText(summaryLike?.query_type).toLowerCase();
  if (qt) return QUERY_TYPE_LABELS[qt] || qt.charAt(0).toUpperCase() + qt.slice(1);
  return "";
}

export function buildDraftFromSource(source: Record<string, unknown> | null | undefined): Partial<SocialFormState> {
  if (!source) return {};
  const { city, district, neighborhood } = resolveLocationFields(source);
  return {
    listingTitle: normalizeText(source.listing_title) || normalizeText(source.title),
    propertyType: inferPropertyType(source),
    city,
    district,
    neighborhood,
    price: normalizeText(source.listing_price_amount ?? source.price_amount ?? source.total_price),
    priceCurrency: normalizeText((source.listing_currency ?? source.currency) || "TL") || "TL",
    areaM2: normalizeText(source.listing_area_m2 ?? source.area_m2),
  };
}

export function buildGalleryUrls(payload: Record<string, unknown> | null | undefined): string[] {
  const direct = Array.isArray(payload?.listing_media) ? (payload!.listing_media as unknown[]) : [];
  return direct
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "url" in item && typeof (item as { url: string }).url === "string") {
        return (item as { url: string }).url.trim();
      }
      return "";
    })
    .filter(Boolean);
}

/** Telefon gösterimi — ekranda da kullanılır */
export function formatPhoneDisplay(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const normalized = digits.length === 10 ? `0${digits}` : digits;
  if (normalized.length === 11 && normalized.startsWith("0")) {
    return `${normalized.slice(0, 1)} ${normalized.slice(1, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7, 9)} ${normalized.slice(9, 11)}`;
  }
  return String(value ?? "").trim();
}

export function resolveAvatarFromSource(
  source: Record<string, unknown> | null | undefined,
  profile: { avatar_url?: string | null } | null,
): string {
  const ownerCard = (source?.owner_card as Record<string, unknown> | undefined) || {};
  return normalizeText(
    ownerCard.avatar_url ?? profile?.avatar_url,
  );
}

export function resolveContactFromSource(
  source: Record<string, unknown> | null | undefined,
  profile: {
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    phone_number?: string | null;
    name?: string | null;
  } | null,
): { name: string; phone: string } {
  const ownerCard = (source?.owner_card as Record<string, unknown> | undefined) || {};
  const fromProfile =
    [normalizeText(profile?.first_name), normalizeText(profile?.last_name)].filter(Boolean).join(" ").trim();
  const name =
    normalizeText(ownerCard.full_name) ||
    normalizeText(profile?.full_name) ||
    normalizeText(profile?.name) ||
    fromProfile;
  const phone = formatPhoneDisplay(
    ownerCard.phone ?? profile?.phone ?? profile?.phone_number,
  );
  return { name, phone };
}

export function buildLocationLine(city: string, district: string, neighborhood: string): string {
  return normalizeText(neighborhood) || normalizeText(district) || normalizeText(city);
}

export function createDefaultEditableAdjustments(): Record<string, EditableAdjustment> {
  return EDITABLE_OVERLAY_ITEMS.reduce(
    (acc, item) => {
      acc[item.id] = { x: 0, y: 0, fontSize: 0 };
      return acc;
    },
    {} as Record<string, EditableAdjustment>,
  );
}

export function createDefaultTemplateAdjustments(): Record<string, Record<string, EditableAdjustment>> {
  return TEMPLATE_OPTIONS.reduce(
    (acc, t) => {
      acc[t.id] = createDefaultEditableAdjustments();
      return acc;
    },
    {} as Record<string, Record<string, EditableAdjustment>>,
  );
}

export function getInitialForm(companyName = ""): SocialFormState {
  return {
    companyName,
    listingTitle: "",
    propertyType: "",
    city: "",
    district: "",
    neighborhood: "",
    price: "",
    priceCurrency: "TL",
    areaM2: "",
    ctaText: "Detayları İncele",
  };
}
