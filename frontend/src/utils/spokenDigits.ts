/**
 * Whisper / konuşma transkriptindeki Türkçe rakam kelimelerini sayıya çevirir.
 * Tek tek rakam (sıfır, beş, üç…) ve gruplu okuma (beş yüz otuz sekiz, …) desteklenir.
 */
const TURKISH_DIGIT_WORDS: Record<string, string> = {
  sıfır: "0",
  sfir: "0",
  sifir: "0",
  zero: "0",
  bir: "1",
  iki: "2",
  üç: "3",
  uc: "3",
  dört: "4",
  dort: "4",
  beş: "5",
  bes: "5",
  altı: "6",
  alti: "6",
  yedi: "7",
  sekiz: "8",
  dokuz: "9",
};

const UNITS: Record<string, number> = {
  sifir: 0,
  sfir: 0,
  zero: 0,
  bir: 1,
  iki: 2,
  uc: 3,
  dort: 4,
  bes: 5,
  alti: 6,
  yedi: 7,
  sekiz: 8,
  dokuz: 9,
};

const TENS: Record<string, number> = {
  on: 10,
  yirmi: 20,
  otuz: 30,
  kirk: 40,
  elli: 50,
  altmis: 60,
  yetmis: 70,
  seksen: 80,
  doksan: 90,
};

function normalizeSpokenToken(text: string): string {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .trim();
}

function replaceDigitWordsWithChars(text: string): string {
  let t = normalizeSpokenToken(text);
  t = t.replace(
    /\b(telefon|numara|numaram|numarasi|numarasi|cep|gsm|hattim|hattim|iletisim)\b/g,
    " ",
  );
  for (const [word, digit] of Object.entries(TURKISH_DIGIT_WORDS)) {
    const normalizedWord = normalizeSpokenToken(word);
    const escaped = normalizedWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp(`\\b${escaped}\\b`, "g"), digit);
  }
  return t.replace(/\D/g, "");
}

function parseTurkishNumberChunk(chunk: string): number | null {
  const words = normalizeSpokenToken(chunk)
    .split(/[\s,;]+/)
    .map((w) => w.trim())
    .filter(Boolean);

  if (!words.length) return null;

  let total = 0;
  let current = 0;

  for (const rawWord of words) {
    const word = normalizeSpokenToken(rawWord);
    if (word in UNITS) {
      current += UNITS[word];
      continue;
    }
    if (word in TENS) {
      current += TENS[word];
      continue;
    }
    if (word === "yuz") {
      current = (current || 1) * 100;
      continue;
    }
    if (word === "bin") {
      current = (current || 1) * 1000;
      total += current;
      current = 0;
      continue;
    }
    return null;
  }

  total += current;
  return Number.isFinite(total) ? total : null;
}

function parseGroupedSpokenPhone(text: string): string {
  const normalized = normalizeSpokenToken(text);
  const parts = normalized
    .split(/\s*[,;.]\s*|\s+ve\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return "";
  }

  const segments: string[] = [];
  for (const part of parts) {
    const num = parseTurkishNumberChunk(part);
    if (num == null) return "";
    segments.push(String(num));
  }

  let joined = segments.join("");
  if (parts[0]?.startsWith("sifir") && !joined.startsWith("0")) {
    joined = `0${joined}`;
  }
  return stripLeadingTrCountryCode(joined);
}

export function normalizeSpokenDigitsToString(text: string): string {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";

  const directDigits = trimmed.replace(/\D/g, "");
  const digitWords = replaceDigitWordsWithChars(trimmed);
  const grouped = parseGroupedSpokenPhone(trimmed);

  const candidates = [grouped, digitWords, directDigits].filter(Boolean);
  const valid = candidates.find((d) => {
    const n = stripLeadingTrCountryCode(d);
    return n.length === 10 && n.startsWith("5");
  });
  if (valid) return stripLeadingTrCountryCode(valid);

  return candidates.sort((a, b) => b.length - a.length)[0] || "";
}

export function stripLeadingTrCountryCode(digits: string): string {
  let d = String(digits || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("90")) {
    d = d.slice(2);
  }
  if (d.length === 11 && d.startsWith("0")) {
    d = d.slice(1);
  }
  return d;
}

const NUMBER_WORD_SET = new Set([
  ...Object.keys(UNITS),
  ...Object.keys(TENS),
  "yuz",
  "bin",
]);

function isSpokenNumberWord(token: string): boolean {
  const w = normalizeSpokenToken(token);
  return NUMBER_WORD_SET.has(w) || /^\d+$/.test(w);
}

function hasCompoundSpokenNumberWord(tokens: string[]): boolean {
  return tokens.some((token) => {
    const w = normalizeSpokenToken(token);
    return w in TENS || w === "yuz" || w === "bin";
  });
}

/** E-posta kullanıcı adı vb. için: "seksen altı" → 86, "sekiz altı" → 86 */
export function convertSpokenNumberWordsInText(text: string): string {
  const tokens = String(text || "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (!tokens.length) return "";

  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (!isSpokenNumberWord(tokens[i])) {
      out.push(tokens[i]);
      i += 1;
      continue;
    }

    let j = i;
    while (j < tokens.length && isSpokenNumberWord(tokens[j])) j += 1;
    const run = tokens.slice(i, j);

    if (hasCompoundSpokenNumberWord(run)) {
      const num = parseTurkishNumberChunk(run.join(" "));
      if (num != null) {
        out.push(String(num));
        i = j;
        continue;
      }
    }

    let digits = "";
    for (const token of run) {
      const w = normalizeSpokenToken(token);
      if (w in UNITS) digits += String(UNITS[w]);
      else if (/^\d+$/.test(w)) digits += w;
    }
    if (digits) {
      out.push(digits);
      i = j;
      continue;
    }

    out.push(tokens[i]);
    i += 1;
  }

  return out.join(" ");
}
