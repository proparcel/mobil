import type { RegistrationCompanyItem } from "../types/auth";
import type {
  VoiceRegistrationContext,
  VoiceRegistrationCorporateType,
  VoiceRegistrationExtractResult,
  VoiceRegistrationField,
  VoiceRegistrationFormPatch,
  VoiceRegistrationLocationValue,
  VoiceRegistrationStepConfig,
} from "../types/voiceRegistration";
import {
  resolveVoiceLocationFromExtract,
  type VoiceLocationExtractInput,
} from "./voiceLocationResolve";
import {
  splitVoiceRegistrationFullName,
  validateVoiceRegistrationAddressDetail,
  validateVoiceRegistrationCompanyName,
  validateVoiceRegistrationDigits,
  validateVoiceRegistrationEmail,
  validateVoiceRegistrationFullName,
  validateVoiceRegistrationPhone,
  normalizeVoiceRegistrationDigits,
  normalizeVoiceRegistrationEmailFromSpeech,
  enforceAsciiEmailAddress,
  resolveVoiceRegistrationPhoneValue,
} from "./voiceRegistrationValidators";

function effectiveConsultantType(
  ctx: VoiceRegistrationContext,
): VoiceRegistrationCorporateType | null {
  if (ctx.memberType !== "consultant") return null;
  if (ctx.selectedCompany?.corporate_type) {
    const t = String(ctx.selectedCompany.corporate_type).toLowerCase();
    if (t === "emlak" || t === "spk" || t === "lihkab") return t;
  }
  return ctx.consultantCorporateType;
}

function needsAddressSteps(ctx: VoiceRegistrationContext): boolean {
  return ctx.memberType === "consultant" || ctx.memberType === "corporate";
}

function needsConsultantCompanyStep(ctx: VoiceRegistrationContext): boolean {
  return ctx.memberType === "consultant" && !ctx.selectedCompany?.company_profile_id;
}

function isConsultantSpk(ctx: VoiceRegistrationContext): boolean {
  return effectiveConsultantType(ctx) === "spk";
}

export function buildVoiceRegistrationSteps(
  ctx: VoiceRegistrationContext,
): VoiceRegistrationStepConfig[] {
  const steps: VoiceRegistrationStepConfig[] = [];

  if (needsConsultantCompanyStep(ctx)) {
    steps.push({
      field: "consultant_company",
      prompt: "Bağlı olduğunuz firmanın adını söyleyin.",
      helper: "Firma listede bulunamazsa kayıt formundan manuel seçebilirsiniz.",
      inputType: "voice",
    });
  }

  steps.push({
    field: "full_name",
    prompt: "Adınızı ve soyadınızı söyleyin.",
    inputType: "voice",
  });

  steps.push({
    field: "phone",
    prompt: "Telefon numaranızı söyleyin.",
    helper:
      ctx.memberType === "individual"
        ? "İsterseniz bu adımı Geç ile atlayabilirsiniz."
        : undefined,
    optional: ctx.memberType === "individual",
    inputType: "voice",
  });

  steps.push({
    field: "email",
    prompt: "E-posta adresinizi söyleyin. Örneğin: sercan et gmail nokta com.",
    inputType: "voice",
  });

  if (needsAddressSteps(ctx)) {
    steps.push({
      field: "location",
      prompt: "İl, ilçe ve mahalle bilginizi söyleyin.",
      inputType: "voice",
    });
    steps.push({
      field: "address_detail",
      prompt: "Sokak, cadde, kapı no, kat ve daire bilginizi söyleyin.",
      inputType: "voice",
    });
  }

  if (ctx.memberType === "corporate") {
    steps.push({
      field: "company_name",
      prompt: "Firma adınızı söyleyin.",
      helper: "Yetki belgeniz varsa ve firma değilseniz bu adımı geçin.",
      optional: true,
      inputType: "voice",
    });
    steps.push({
      field: "company_license_no",
      prompt: "Lisans veya yetki belge numaranızı söyleyin.",
      inputType: "voice",
    });
    if (ctx.corporateType === "spk") {
      steps.push({
        field: "spk_tc_no",
        prompt: "TC kimlik numaranızı söyleyin.",
        inputType: "voice",
      });
    }
    if (ctx.corporateType === "lihkab") {
      steps.push({
        field: "office_no",
        prompt: "Büro numaranızı söyleyin.",
        inputType: "voice",
      });
    }
  }

  if (ctx.memberType === "consultant" && isConsultantSpk(ctx)) {
    steps.push({
      field: "consultant_license_no",
      prompt: "SPK lisans numaranızı söyleyin.",
      inputType: "voice",
    });
  }

  steps.push({
    field: "manual_password",
    prompt: "Sesli üyelik bilgileri tamamlandı. Lütfen şifrenizi elle girin.",
    inputType: "manual_password",
  });

  return steps;
}

export function validateVoiceFieldLocally(
  field: VoiceRegistrationField,
  value: unknown,
  ctx: VoiceRegistrationContext,
): { ok: true } | { ok: false; message: string } {
  if (field === "manual_password") return { ok: true };

  if (field === "full_name") {
    if (!validateVoiceRegistrationFullName(String(value || ""))) {
      return { ok: false, message: "Lütfen adınızı ve soyadınızı birlikte söyleyin." };
    }
    return { ok: true };
  }

  if (field === "phone") {
    const raw = String(value || "").trim();
    if (!raw && ctx.memberType === "individual") return { ok: true };
    const normalized = resolveVoiceRegistrationPhoneValue(value);
    if (!validateVoiceRegistrationPhone(normalized)) {
      return {
        ok: false,
        message: "Telefon numarası doğru algılanamadı. Lütfen sadece numaranızı tekrar söyleyin.",
      };
    }
    return { ok: true };
  }

  if (field === "email") {
    if (!validateVoiceRegistrationEmail(String(value || ""))) {
      return {
        ok: false,
        message:
          "E-posta adresi doğru algılanamadı. Lütfen örnek olarak \"sercan et gmail nokta com\" şeklinde tekrar söyleyin.",
      };
    }
    return { ok: true };
  }

  if (field === "address_detail") {
    if (!validateVoiceRegistrationAddressDetail(String(value || ""))) {
      return {
        ok: false,
        message:
          "Açık adres detayı doğru algılanamadı. Lütfen sokak, kapı no, kat ve daire bilgilerinizi tekrar söyleyin.",
      };
    }
    return { ok: true };
  }

  if (field === "company_name") {
    if (!value) return { ok: true };
    if (!validateVoiceRegistrationCompanyName(String(value))) {
      return { ok: false, message: "Firma adı algılanamadı. Lütfen tekrar söyleyin veya Geç ile atlayın." };
    }
    return { ok: true };
  }

  if (field === "company_license_no") {
    if (!String(value || "").trim()) {
      return { ok: false, message: "Lisans / yetki belge numarası gereklidir." };
    }
    return { ok: true };
  }

  if (field === "spk_tc_no") {
    if (!validateVoiceRegistrationDigits(String(value || ""), [11])) {
      return { ok: false, message: "SPK için 11 haneli TC kimlik numarası gereklidir." };
    }
    return { ok: true };
  }

  if (field === "office_no") {
    if (!String(value || "").trim()) {
      return { ok: false, message: "LİHKAB büro numarası gereklidir." };
    }
    return { ok: true };
  }

  if (field === "consultant_license_no") {
    if (!String(value || "").trim()) {
      return { ok: false, message: "SPK lisans numarası gereklidir." };
    }
    return { ok: true };
  }

  if (field === "consultant_company") {
    const v = value as { company_profile_id?: number } | null;
    if (!v?.company_profile_id) {
      return { ok: false, message: "Firma eşleştirilemedi. Lütfen tekrar söyleyin veya formdan seçin." };
    }
    return { ok: true };
  }

  if (field === "location") {
    const loc = value as VoiceRegistrationLocationValue | null;
    if (!loc?.city_id || !loc?.town_id || !loc?.quarter_id) {
      return {
        ok: false,
        message: "İl, ilçe ve mahalle bilgisi eşleştirilemedi. Lütfen tekrar söyleyin.",
      };
    }
    return { ok: true };
  }

  return { ok: true };
}

export async function resolveVoiceRegistrationLocation(
  apiResult: VoiceRegistrationExtractResult,
): Promise<{ ok: true; location: VoiceRegistrationLocationValue } | { ok: false; error: string }> {
  const raw = apiResult.value as VoiceRegistrationLocationValue | undefined;
  const input: VoiceLocationExtractInput = {
    il: raw?.il,
    ilce: raw?.ilce,
    mahalle: raw?.mahalle,
    city_id: raw?.city_id,
    town_id: raw?.town_id,
    quarter_id: raw?.quarter_id,
    tkgm_value: raw?.tkgm_value,
    proparcel_value: raw?.proparcel_value,
    transcript: apiResult.raw_text,
  };

  const locResult = await resolveVoiceLocationFromExtract(input);
  if (!locResult.ok) {
    return {
      ok: false,
      error: apiResult.message || locResult.error,
    };
  }

  const { location } = locResult;

  return {
    ok: true,
    location: {
      city_id: location.cityId,
      town_id: location.townId,
      quarter_id: location.quarterId,
      il: location.cityName,
      ilce: location.townName,
      mahalle: location.quarterName,
      tkgm_value: location.tkgmValue,
      proparcel_value: location.proparcelValue,
    },
  };
}

export function buildFormPatchFromVoiceField(
  field: VoiceRegistrationField,
  value: unknown,
  locationResolved?: VoiceRegistrationLocationValue,
): VoiceRegistrationFormPatch {
  const patch: VoiceRegistrationFormPatch = {};

  if (field === "full_name") {
    const split = splitVoiceRegistrationFullName(String(value || ""));
    if (split) {
      patch.firstName = split.firstName;
      patch.lastName = split.lastName;
    }
    return patch;
  }

  if (field === "phone") {
    const normalized = resolveVoiceRegistrationPhoneValue(value);
    if (normalized) patch.phoneNumber = normalized;
    return patch;
  }

  if (field === "email") {
    patch.email = enforceAsciiEmailAddress(
      normalizeVoiceRegistrationEmailFromSpeech(String(value || "")),
    );
    return patch;
  }

  if (field === "company_name") {
    patch.companyName = String(value || "").trim();
    return patch;
  }

  if (field === "company_license_no") {
    patch.companyLicenseNo = String(value || "").trim();
    return patch;
  }

  if (field === "spk_tc_no") {
    patch.spkTcNo = normalizeVoiceRegistrationDigits(String(value || ""));
    return patch;
  }

  if (field === "office_no") {
    patch.officeNo = String(value || "").trim();
    return patch;
  }

  if (field === "consultant_license_no") {
    patch.consultantLicenseNo = String(value || "").trim();
    return patch;
  }

  if (field === "consultant_company") {
    const company = value as {
      company_profile_id: number;
      company_name: string;
      corporate_type?: string | null;
    };
    if (company?.company_profile_id) {
      patch.selectedCompany = {
        company_profile_id: company.company_profile_id,
        company_name: company.company_name,
        corporate_type: (company.corporate_type as RegistrationCompanyItem["corporate_type"]) ?? null,
      };
    }
    return patch;
  }

  if (field === "location" && locationResolved) {
    patch.corporateAddress = {
      cityId: locationResolved.city_id,
      cityName: locationResolved.il || "",
      districtId: locationResolved.town_id,
      districtName: locationResolved.ilce || "",
      quarterId: locationResolved.quarter_id,
      quarterName: locationResolved.mahalle || "",
      quarterValue:
        locationResolved.tkgm_value != null ? Number(locationResolved.tkgm_value) : null,
      streetAndNumber: "",
    };
    return patch;
  }

  if (field === "address_detail") {
    patch.corporateAddress = {
      streetAndNumber: String(value || "").trim(),
    };
    return patch;
  }

  return patch;
}

export function buildVoiceRegistrationResultSummary(
  field: VoiceRegistrationField,
  value: unknown,
): string {
  if (field === "full_name") {
    const name = String(value || "").trim();
    return name ? `Ad Soyad: ${name}` : "Ad soyad kaydedildi";
  }
  if (field === "phone") {
    const phone = resolveVoiceRegistrationPhoneValue(value);
    return phone ? `Telefon: ${phone}` : "Telefon kaydedildi";
  }
  if (field === "email") {
    return `E-posta: ${enforceAsciiEmailAddress(
      normalizeVoiceRegistrationEmailFromSpeech(String(value || "")),
    )}`;
  }
  if (field === "location") {
    const loc = value as VoiceRegistrationLocationValue;
    const parts = [loc?.il, loc?.ilce, loc?.mahalle].filter(Boolean);
    return parts.length ? parts.join(" / ") : "Konum kaydedildi";
  }
  if (field === "address_detail") {
    const detail = String(value || "").trim();
    return detail ? `Adres: ${detail}` : "Adres kaydedildi";
  }
  if (field === "company_name") {
    const name = String(value || "").trim();
    return name ? `Firma: ${name}` : "Firma adı atlandı";
  }
  if (field === "company_license_no") {
    return `Belge No: ${String(value || "").trim()}`;
  }
  if (field === "spk_tc_no") {
    return `TC Kimlik No: ${normalizeVoiceRegistrationDigits(String(value || ""))}`;
  }
  if (field === "office_no") {
    return `Büro No: ${String(value || "").trim()}`;
  }
  if (field === "consultant_license_no") {
    return `Lisans No: ${String(value || "").trim()}`;
  }
  if (field === "consultant_company") {
    const company = value as { company_name?: string };
    return company?.company_name
      ? `Firma: ${company.company_name}`
      : "Firma seçildi";
  }
  return "Kayıt alındı";
}

export function canOpenVoiceRegistrationWizard(ctx: VoiceRegistrationContext): {
  ok: true;
} | { ok: false; message: string } {
  if (ctx.memberType === "corporate" && !ctx.corporateType) {
    return { ok: false, message: "Sesli üyelik için önce firma tipini (Emlak / SPK / LİHKAB) seçin." };
  }
  return { ok: true };
}
