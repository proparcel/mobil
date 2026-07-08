import type {
  ListingWizardContent,
  ListingWizardForm,
  ListingWizardState,
} from "../types/listingWizard";
import { EMPTY_LISTING_WIZARD_FORM } from "../types/listingWizard";

function pick<T>(formVal: T | undefined | null, contentVal: T | undefined | null): T | undefined | null {
  if (formVal != null && formVal !== "" && !(Array.isArray(formVal) && formVal.length === 0)) {
    return formVal;
  }
  return contentVal;
}

export function contentToForm(content?: ListingWizardContent | null): ListingWizardForm {
  const c = content || {};
  const bc = c.category_breadcrumb;
  let labels: string[] = [];
  if (Array.isArray(bc)) {
    labels = bc.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") return String((item as { label?: string }).label || "");
      return "";
    }).filter(Boolean);
  }
  const ll = (c.location_labels && typeof c.location_labels === "object" ? c.location_labels : {}) as Record<
    string,
    string
  >;
  const pv = String(c.portal_visibility || "public").trim().toLowerCase();
  return {
    eidsTasinmazId:
      c.eids_tasinmaz_id != null && String(c.eids_tasinmaz_id).trim() !== ""
        ? String(c.eids_tasinmaz_id)
        : "",
    eidsAuthorization:
      c.eids_authorization && typeof c.eids_authorization === "object" ? c.eids_authorization : null,
    categoryLeafId: String(c.category_leaf_id || ""),
    categoryBreadcrumbLabels: labels,
    title: String(c.title || ""),
    listingType: c.listing_type === "rent" ? "rent" : "sale",
    currency: String(c.currency || "TRY"),
    priceAmount: c.price_amount != null && Number.isFinite(Number(c.price_amount)) ? String(c.price_amount) : "",
    ada: String(c.ada || ll.ada || ""),
    parsel: String(c.parsel || ll.parsel || ""),
    cityId: String(c.city_id || ""),
    districtId: String(c.district_id || ""),
    quarterId: String(c.quarter_id || ""),
    proparcelValue: c.proparcel_value != null ? String(c.proparcel_value) : "",
    mahalleTkgmValue: String(c.mahalle_tkgm_value || ""),
    areaM2: c.area_m2 != null ? String(c.area_m2) : "",
    locationLabels: {
      il: String(ll.il || ""),
      ilce: String(ll.ilce || ""),
      mahalle: String(ll.mahalle || ""),
      ada: String(ll.ada || c.ada || ""),
      parsel: String(ll.parsel || c.parsel || ""),
    },
    listingAttributes:
      c.listing_attributes && typeof c.listing_attributes === "object"
        ? { ...c.listing_attributes }
        : {},
    listingMedia: Array.isArray(c.listing_media) ? [...c.listing_media] : [],
    description: String(c.description || ""),
    portalVisibility: pv === "vault" ? "vault" : "public",
  };
}

export function mergeWizardState(wizard: ListingWizardState, form: ListingWizardForm): ListingWizardForm {
  return contentToForm(wizard.content);
}

export function formFieldsForStep(
  stepKey: string,
  form: ListingWizardForm,
): Record<string, unknown> {
  switch (stepKey) {
    case "eids_authorization":
      return {};
    case "category_selection":
      return {
        category_leaf_id: form.categoryLeafId.trim(),
        category_breadcrumb: form.categoryBreadcrumbLabels.map((label, i) => ({
          label,
          id: form.categoryLeafId,
        })),
      };
    case "core_details": {
      const price = Number(String(form.priceAmount || "").replace(/\./g, "").replace(",", "."));
      return {
        listing_type: form.listingType,
        currency: form.currency || "TRY",
        price_amount: Number.isFinite(price) && price > 0 ? Math.round(price) : undefined,
      };
    }
    case "location":
      return {
        ada: form.ada.trim(),
        parsel: form.parsel.trim(),
        city_id: form.cityId.trim() || undefined,
        district_id: form.districtId.trim() || undefined,
        quarter_id: form.quarterId.trim() || undefined,
        proparcel_value: form.proparcelValue ? Number(form.proparcelValue) : undefined,
        mahalle_tkgm_value: form.mahalleTkgmValue.trim() || undefined,
        area_m2: form.areaM2 ? Number(form.areaM2) : undefined,
        location_resolved: Boolean(form.ada.trim() && form.parsel.trim()),
        location_labels: {
          il: form.locationLabels.il || "",
          ilce: form.locationLabels.ilce || "",
          mahalle: form.locationLabels.mahalle || "",
          ada: form.ada.trim(),
          parsel: form.parsel.trim(),
        },
      };
    case "dynamic_attributes":
      return { listing_attributes: form.listingAttributes };
    case "description":
      return {
        title: form.title.trim(),
        description: form.description.trim(),
      };
    case "visibility_confirmation":
      return { portal_visibility: form.portalVisibility };
    default:
      return {};
  }
}

export function validateStep(stepKey: string, form: ListingWizardForm, eidsAuthenticated?: boolean): string | null {
  switch (stepKey) {
    case "eids_authorization": {
      const tid = form.eidsTasinmazId.trim();
      if (!tid) return "Taşınmaz ID zorunludur.";
      if (tid !== "0" && !eidsAuthenticated) return "Önce E-Devlet ile EİDS kullanıcı doğrulamasını tamamlayın.";
      return null;
    }
    case "category_selection":
      if (!form.categoryLeafId.trim()) return "Kategori seçimi zorunludur.";
      return null;
    case "core_details": {
      const price = Number(String(form.priceAmount || "").replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(price) || price <= 0) return "Fiyat sıfırdan büyük olmalıdır.";
      return null;
    }
    case "location":
      if (!form.ada.trim() || !form.parsel.trim()) return "Ada ve parsel zorunludur.";
      return null;
    case "description":
      if (!form.title.trim()) return "Başlık zorunludur.";
      return null;
    case "visibility_confirmation":
      if (form.portalVisibility !== "public" && form.portalVisibility !== "vault") {
        return "Görünürlük seçimi zorunludur.";
      }
      return null;
    default:
      return null;
  }
}

export function resetForm(): ListingWizardForm {
  return { ...EMPTY_LISTING_WIZARD_FORM };
}
