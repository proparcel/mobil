import type { ListingWizardStepKey } from "../types/listingWizard";

export type WizardStepDef = {
  key: ListingWizardStepKey;
  label: string;
  hint?: string;
};

export const WIZARD_STEPS: WizardStepDef[] = [
  {
    key: "eids_authorization",
    label: "EİDS yetki",
    hint: "E-Devlet doğrulaması ve taşınmaz yetkisi tamamlanmadan ilan bilgilerine geçilemez.",
  },
  { key: "category_selection", label: "Kategori seçimi", hint: "Hızlı seçim veya sütunlardan ilerleyin." },
  { key: "core_details", label: "Temel bilgiler", hint: "İlan tipi ve fiyat; fiyat sıfırdan büyük olmalıdır." },
  {
    key: "location",
    label: "Konum",
    hint: "Ada ve parsel zorunludur; il · ilçe · mahalle TKGM ile doğrulanır.",
  },
  { key: "dynamic_attributes", label: "Detaylar", hint: "" },
  { key: "media", label: "Galeri", hint: "Fotoğraf (en fazla 24)." },
  { key: "description", label: "Açıklama", hint: "Başlık ve ilan metnini yazın veya yapay zeka ile oluşturun." },
  { key: "preview", label: "Önizleme", hint: "Özeti kontrol edin." },
  {
    key: "visibility_confirmation",
    label: "Görünürlük onayı",
    hint: "Açık vitrin veya Sandık (danışmanlara özel).",
  },
  { key: "publish", label: "Yayın", hint: "Yayınlamak için onaylayın." },
];

export const EDIT_WIZARD_STEP_KEYS: ListingWizardStepKey[] = [
  "core_details",
  "dynamic_attributes",
  "media",
  "description",
  "preview",
  "visibility_confirmation",
  "publish",
];

export function stepsForMode(mode: "create" | "edit", forceEidsFirst?: boolean): WizardStepDef[] {
  if (mode === "edit" && !forceEidsFirst) {
    return EDIT_WIZARD_STEP_KEYS.map((key) => WIZARD_STEPS.find((s) => s.key === key)!).filter(Boolean);
  }
  if (mode === "edit" && forceEidsFirst) {
    const eids = WIZARD_STEPS.find((s) => s.key === "eids_authorization")!;
    const edit = EDIT_WIZARD_STEP_KEYS.map((key) => WIZARD_STEPS.find((s) => s.key === key)!).filter(Boolean);
    return [eids, ...edit];
  }
  return WIZARD_STEPS;
}

export function stepIndex(steps: WizardStepDef[], key: string): number {
  return steps.findIndex((s) => s.key === key);
}
