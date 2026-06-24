/**
 * Drone alt yazı: sözcüklerle yazılmış tutarları TR rakam biçimine çevirir,
 * kelime başlarını Türkçe kurallarına göre büyütür (web ile aynı).
 */

const BASIC: Record<string, number> = {
  sıfır: 0, bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6, yedi: 7, sekiz: 8, dokuz: 9,
};
const ONLAR: Record<string, number> = {
  on: 10, yirmi: 20, otuz: 30, kırk: 40, elli: 50, altmış: 60, yetmiş: 70, seksen: 80, doksan: 90,
};
const SCALE: Record<string, number> = { bin: 1000, milyon: 1e6, milyar: 1e9, trilyon: 1e12 };
const SUFFIXES = ["trilyon", "milyar", "milyon", "bin", "yüz"];

export function nf(w: string): string {
  let out = "";
  for (const ch of String(w || "").toLocaleLowerCase("tr-TR")) {
    if (/\p{L}/u.test(ch)) out += ch;
  }
  return out;
}

function lettersOnlyTr(w: string): string {
  let out = "";
  for (const ch of String(w || "").toLocaleLowerCase("tr-TR")) {
    if (/\p{L}/u.test(ch)) out += ch;
  }
  return out;
}

export function parseTurkishNumberWords(parts: string[]): number | null {
  let total = 0;
  let current = 0;
  let any = false;
  for (const raw of parts || []) {
    const w = nf(raw);
    if (!w) continue;
    any = true;
    if (Object.prototype.hasOwnProperty.call(BASIC, w)) {
      current += BASIC[w];
    } else if (Object.prototype.hasOwnProperty.call(ONLAR, w)) {
      current += ONLAR[w];
    } else if (w === "yüz") {
      if (current === 0) current = 1;
      current *= 100;
    } else if (Object.prototype.hasOwnProperty.call(SCALE, w)) {
      let part = current;
      if (part === 0) part = 1;
      total += part * SCALE[w];
      current = 0;
    } else {
      return null;
    }
  }
  if (!any) return null;
  return total + current;
}

function explodeOneToken(raw: string): string[] {
  const t = String(raw || "").trim();
  if (!t) return [];
  if (/^[\d.,₺]+$/u.test(t)) return [t];
  const tn = lettersOnlyTr(t);
  if (!tn || tn.length < 3) return [t];
  for (const suf of SUFFIXES) {
    if (!tn.endsWith(suf) || tn.length <= suf.length) continue;
    const pre = tn.slice(0, tn.length - suf.length);
    if (suf === "yüz" && !pre) return ["yüz"];
    if (suf === "bin" && !pre) return ["bin"];
    if (!pre) continue;
    const okPre =
      Object.prototype.hasOwnProperty.call(BASIC, pre) ||
      Object.prototype.hasOwnProperty.call(ONLAR, pre);
    if (okPre) return [pre, suf];
  }
  return [t];
}

function tokenizePhrases(text: string): string[] {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .flatMap((tok) => explodeOneToken(tok));
}

function formatTryNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  return `${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)} TL`;
}

function isCurrencyToken(w: string): boolean {
  const s = String(w || "").trim();
  if (s.includes("₺")) return true;
  const k = nf(s);
  return k === "tl" || k === "try" || k === "lira";
}

export function substituteTurkishSpelledMoney(phrase: string): string {
  const arr = tokenizePhrases(phrase);
  if (!arr.length) return String(phrase || "").trim();

  const out: string[] = [];
  let i = 0;
  while (i < arr.length) {
    let hit = false;
    const ceiling = Math.min(24, arr.length - i - 1);
    for (let span = ceiling; span >= 1; span -= 1) {
      const curIdx = i + span;
      if (curIdx >= arr.length) continue;
      if (!isCurrencyToken(arr[curIdx])) continue;
      const val = parseTurkishNumberWords(arr.slice(i, curIdx));
      if (val === null || !Number.isFinite(val)) continue;
      out.push(formatTryNumber(val));
      i = curIdx + 1;
      hit = true;
      break;
    }
    if (!hit) {
      out.push(arr[i]);
      i += 1;
    }
  }
  return out.join(" ");
}

function titleCaseOneWord(word: string): string {
  const w = String(word);
  if (!w) return w;
  const nk = nf(w);
  if (nk === "tl") return "TL";
  if (nk === "try") return "TRY";
  if (nk === "lira") return "TL";
  if (/^\d/.test(w) || /^[0-9.,]+$/.test(w.replace(/\s/g, ""))) return w;
  const m = w.match(/^([^0-9₺\p{L}]*)([\p{L}ğüşıöçĞÜŞİÖÇ].*)$/u);
  if (!m) return w;
  const lead = m[1] || "";
  const rest = m[2] || "";
  if (!rest) return w;
  const first = rest.charAt(0);
  const tail = rest.slice(1);
  return lead + first.toLocaleUpperCase("tr-TR") + tail.toLocaleLowerCase("tr-TR");
}

function titleCaseTurkishWords(text: string): string {
  return String(text || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => titleCaseOneWord(w))
    .join(" ");
}

export function formatSubtitlePhraseTr(raw: string): string {
  const s1 = substituteTurkishSpelledMoney(String(raw || "").replace(/\s+/g, " ").trim());
  return titleCaseTurkishWords(s1);
}
