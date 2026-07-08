import type { RegistrationCompanyItem } from "./auth";

export type VoiceRegistrationMemberType = "individual" | "consultant" | "corporate";

export type VoiceRegistrationCorporateType = "emlak" | "spk" | "lihkab";

export type VoiceRegistrationField =
  | "full_name"
  | "phone"
  | "email"
  | "location"
  | "address_detail"
  | "company_name"
  | "company_license_no"
  | "spk_tc_no"
  | "office_no"
  | "consultant_license_no"
  | "consultant_company"
  | "manual_password";

export type VoiceRegistrationWizardState =
  | "idle"
  | "listening"
  | "processing"
  | "error"
  | "completed";

export type VoiceRegistrationPendingReview =
  | {
      status: "success";
      summary: string;
      patch: VoiceRegistrationFormPatch;
      field: VoiceRegistrationField;
    }
  | {
      status: "error";
      message: string;
    };

export type VoiceRegistrationInputType = "voice" | "manual_password";

export type VoiceRegistrationSegmentMarker = {
  field: VoiceRegistrationField;
  startMs: number;
  endMs: number;
  optional?: boolean;
};

export type VoiceRegistrationBatchSuccess = {
  field: VoiceRegistrationField;
  patch: VoiceRegistrationFormPatch;
};

export type VoiceRegistrationBatchFailure = {
  field: VoiceRegistrationField;
  message: string;
};

export type VoiceRegistrationBatchResult = {
  successes: VoiceRegistrationBatchSuccess[];
  failures: VoiceRegistrationBatchFailure[];
};

export type VoiceRegistrationStepConfig = {
  field: VoiceRegistrationField;
  prompt: string;
  helper?: string;
  optional?: boolean;
  inputType: VoiceRegistrationInputType;
};

export type VoiceRegistrationContext = {
  memberType: VoiceRegistrationMemberType;
  corporateType: VoiceRegistrationCorporateType | null;
  selectedCompany: RegistrationCompanyItem | null;
  consultantCorporateType: VoiceRegistrationCorporateType | null;
};

export type VoiceRegistrationLocationValue = {
  city_id: number;
  town_id: number;
  quarter_id: number;
  il?: string;
  ilce?: string;
  mahalle?: string;
  tkgm_value?: number | null;
  proparcel_value?: number | null;
};

export type VoiceRegistrationCompanyValue = {
  company_profile_id: number;
  company_name: string;
  corporate_type?: VoiceRegistrationCorporateType | null;
};

export type VoiceRegistrationFieldValue =
  | string
  | VoiceRegistrationLocationValue
  | VoiceRegistrationCompanyValue
  | null;

export type VoiceRegistrationExtractResult = {
  ok: boolean;
  field: VoiceRegistrationField;
  raw_text?: string;
  value?: VoiceRegistrationFieldValue;
  is_valid?: boolean;
  error?: string;
  message?: string | null;
  debug_normalized?: string | null;
  candidates?: VoiceRegistrationCompanyValue[];
};

export type VoiceRegistrationResolvedField = {
  field: VoiceRegistrationField;
  value: VoiceRegistrationFieldValue;
  rawText?: string;
};

export type VoiceRegistrationFormPatch = {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  companyName?: string;
  companyLicenseNo?: string;
  spkTcNo?: string;
  officeNo?: string;
  consultantLicenseNo?: string;
  selectedCompany?: RegistrationCompanyItem | null;
  corporateAddress?: Partial<{
    cityId: number | null;
    cityName: string;
    districtId: number | null;
    districtName: string;
    quarterId: number | null;
    quarterName: string;
    quarterValue: number | null;
    streetAndNumber: string;
  }>;
};
