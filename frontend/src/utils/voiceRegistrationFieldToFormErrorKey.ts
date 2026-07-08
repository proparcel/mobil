import type { VoiceRegistrationField } from "../types/voiceRegistration";

/** Sesli üyelik API alanı → register.tsx `errors` state anahtarı. */
export function voiceRegistrationFieldToFormErrorKey(
  field: VoiceRegistrationField,
): string | null {
  switch (field) {
    case "full_name":
      return "firstName";
    case "phone":
      return "phone";
    case "email":
      return "email";
    case "location":
      return "address";
    case "address_detail":
      return "streetAndNumber";
    case "company_name":
      return "companyName";
    case "company_license_no":
      return "companyLicenseNo";
    case "spk_tc_no":
      return "spkTcNo";
    case "office_no":
      return "officeNo";
    case "consultant_license_no":
      return "consultantLicenseNo";
    case "consultant_company":
      return "companyPicker";
    case "manual_password":
      return null;
    default:
      return null;
  }
}
