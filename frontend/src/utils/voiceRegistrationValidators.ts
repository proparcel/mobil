import {
  convertSpokenNumberWordsInText,
  normalizeSpokenDigitsToString,
  stripLeadingTrCountryCode,
} from "./spokenDigits";

const EMAIL_REGEX = /^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

const TR_TO_ASCII: [string, string][] = [
  ["ç", "c"],
  ["Ç", "c"],
  ["ğ", "g"],
  ["Ğ", "g"],
  ["ı", "i"],
  ["İ", "i"],
  ["ö", "o"],
  ["Ö", "o"],
  ["ş", "s"],
  ["Ş", "s"],
  ["ü", "u"],
  ["Ü", "u"],
];

const EMAIL_PROVIDER_RE =
  /\b(gmail|hotmail|yahoo|outlook|icloud|yandex|protonmail|live|msn)\b/i;

/** Türkçe karakterleri e-posta için ASCII karşılığına çevirir. */
export function transliterateTurkishToAscii(text: string): string {
  let s = String(text || "");
  for (const [tr, ascii] of TR_TO_ASCII) {
    s = s.split(tr).join(ascii);
  }
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ı/g, "i");
}

/** E-posta local/domain parçalarında yalnızca ASCII bırakır. */
export function enforceAsciiEmailAddress(email: string): string {
  let e = transliterateTurkishToAscii(email);
  const at = e.indexOf("@");
  if (at <= 0) {
    return e.replace(/[^a-z0-9._+-]/g, "");
  }
  const local = e.slice(0, at).replace(/[^a-z0-9._+-]/g, "");
  const domain = e.slice(at + 1).replace(/[^a-z0-9.-]/g, "");
  return domain ? `${local}@${domain}` : local;
}

/** Whisper / konuşma transkriptinden e-posta normalizasyonu. */
export function normalizeVoiceRegistrationEmailFromSpeech(raw: string): string {
  let t = transliterateTurkishToAscii(raw).trim();
  t = t.replace(/\s+/g, " ");
  t = t.replace(/\b(e-?posta|eposta|mail\s*adres(?:im|i|in)?)\b/g, " ");
  t = applyEmailSpokenPunctuation(t);
  t = t.replace(/\bkuyruklu\s*a\b/g, "@");
  t = t.replace(/\be\s+mail\b/g, "@");
  t = t.replace(/\b(et|at|arroba)\b/g, "@");
  t = t.replace(/\b(nokta|dot)\b/g, ".");
  t = convertSpokenNumberWordsInText(t);
  t = t.replace(
    /\b(gmail|hotmail|yahoo|outlook|icloud|yandex|protonmail|live|msn)\s+(com|net|org|tr)\b/g,
    "$1.$2",
  );
  if (!t.includes("@") && EMAIL_PROVIDER_RE.test(t)) {
    t = t.replace(EMAIL_PROVIDER_RE, "@$1");
  }
  t = t.replace(/@([a-z0-9._-]+)\s+(com|net|org|tr)\b/g, "@$1.$2");
  t = t.replace(/\s*\.\s*/g, ".");
  t = t.replace(/@\s+/g, "@");
  t = t.replace(/\s+@/g, "@");
  t = t.replace(/\s+/g, "");
  t = t.replace(/\.{2,}/g, ".");

  const atIdx = t.indexOf("@");
  if (atIdx > 0) {
    t = fixGluedEmailPunctuationInLocal(t.slice(0, atIdx)) + t.slice(atIdx);
  }

  return enforceAsciiEmailAddress(t);
}

/** "alt tire", "altire" → _ ; "üst tire", "usttire" → - */
function applyEmailSpokenPunctuation(text: string): string {
  let t = text;
  t = t.replace(/\balt\s*(?:tire|çizgi|cizgi)\b/g, "_");
  t = t.replace(/\baltire\b/g, "_");
  t = t.replace(/\baltcizgi\b/g, "_");
  t = t.replace(/\b(ust|üst)\s*(?:tire|çizgi|cizgi)\b/g, "-");
  t = t.replace(/\b(usttire|ustire|ustcizgi)\b/g, "-");
  t = t.replace(/\bunderscore\b/g, "_");
  t = t.replace(/\b(hyphen|dash)\b/g, "-");
  t = t.replace(/\btire\b/g, "-");
  return t;
}

/** Boşluklar kalktıktan sonra bitişik kalan: buyukaltiretest → buyuk_test */
function fixGluedEmailPunctuationInLocal(local: string): string {
  return local
    .replace(/altire/g, "_")
    .replace(/altcizgi/g, "_")
    .replace(/usttire|ustire|ustcizgi/g, "-");
}

export function resolveVoiceRegistrationEmailValue(
  value: unknown,
  rawText?: string | null,
  debugNormalized?: string | null,
): string {
  const candidates: string[] = [];
  if (debugNormalized) candidates.push(String(debugNormalized));
  if (typeof value === "string" || typeof value === "number") {
    candidates.push(String(value));
  }
  if (rawText) candidates.push(String(rawText));

  for (const candidate of candidates) {
    const normalized = normalizeVoiceRegistrationEmailFromSpeech(candidate);
    if (validateVoiceRegistrationEmail(normalized)) {
      return enforceAsciiEmailAddress(normalized);
    }
  }

  for (const candidate of candidates) {
    const normalized = normalizeVoiceRegistrationEmailFromSpeech(candidate);
    if (normalized) return enforceAsciiEmailAddress(normalized);
  }

  return "";
}

export function validateVoiceRegistrationEmail(value: string): boolean {
  const normalized = enforceAsciiEmailAddress(
    normalizeVoiceRegistrationEmailFromSpeech(String(value || "")),
  );
  return EMAIL_REGEX.test(normalized);
}
export function normalizeVoiceRegistrationPhoneFromSpeech(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";

  const spokenDigits = normalizeSpokenDigitsToString(trimmed);
  const directDigits = trimmed.replace(/\D/g, "");
  const digits = spokenDigits.length >= directDigits.length ? spokenDigits : directDigits;

  return stripLeadingTrCountryCode(digits);
}

export function validateVoiceRegistrationPhone(value: string): boolean {
  const digits = normalizeVoiceRegistrationPhoneFromSpeech(value);
  return digits.length === 10 && digits.startsWith("5");
}

export function normalizeVoiceRegistrationPhone(value: string): string {
  return normalizeVoiceRegistrationPhoneFromSpeech(value);
}

export function resolveVoiceRegistrationPhoneValue(
  value: unknown,
  rawText?: string | null,
  debugNormalized?: string | null,
): string {
  const candidates: string[] = [];
  if (debugNormalized) candidates.push(String(debugNormalized));
  if (typeof value === "string" || typeof value === "number") {
    candidates.push(String(value));
  }
  if (rawText) {
    candidates.push(String(rawText));
  }

  for (const candidate of candidates) {
    const normalized = normalizeVoiceRegistrationPhoneFromSpeech(candidate);
    if (validateVoiceRegistrationPhone(normalized)) {
      return normalized;
    }
  }

  for (const candidate of candidates) {
    const normalized = normalizeVoiceRegistrationPhoneFromSpeech(candidate);
    if (normalized) return normalized;
  }

  return "";
}

export function validateVoiceRegistrationFullName(value: string): boolean {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length < 2) return false;
  const digitHeavy = parts.every((p) => /^\d+$/.test(p));
  return !digitHeavy;
}

export function splitVoiceRegistrationFullName(value: string): {
  firstName: string;
  lastName: string;
} | null {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length < 2) return null;
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

export function validateVoiceRegistrationDigits(
  value: string,
  lengths: number[],
): boolean {
  const digits = String(value || "").replace(/\D/g, "");
  return lengths.includes(digits.length) && digits.length > 0;
}

export function normalizeVoiceRegistrationDigits(value: string): string {
  const trimmed = String(value || "").trim();
  const spoken = normalizeSpokenDigitsToString(trimmed);
  const direct = trimmed.replace(/\D/g, "");
  return spoken.length >= direct.length ? spoken : direct;
}

export function validateVoiceRegistrationAddressDetail(value: string): boolean {
  const trimmed = String(value || "").trim();
  return trimmed.length >= 8;
}

export function validateVoiceRegistrationCompanyName(value: string): boolean {
  return String(value || "").trim().length >= 2;
}

export function maskPhoneForLog(value: string): string {
  const d = normalizeVoiceRegistrationPhone(value);
  if (d.length < 4) return "****";
  return `${d.slice(0, 3)}****${d.slice(-3)}`;
}

export function maskEmailForLog(value: string): string {
  const email = String(value || "").trim();
  const at = email.indexOf("@");
  if (at <= 1) return "***@***";
  return `${email[0]}***${email.slice(at)}`;
}

export function maskIdForLog(value: string): string {
  const d = normalizeVoiceRegistrationDigits(value);
  if (d.length < 4) return "****";
  return `${d.slice(0, 3)}****${d.slice(-3)}`;
}
