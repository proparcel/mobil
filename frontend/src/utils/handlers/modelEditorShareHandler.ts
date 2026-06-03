/**
 * 3D Model Editör – Çoklu görsel paylaşım (tek seferde)
 * message gönderilmez - sadece resimler paylaşılır.
 * DocumentDirectory dosyaları paylaşım öncesi cache'e kopyalanır (Android FileProvider uyumu).
 */

import Share from "react-native-share";
import RNFS from "react-native-fs";
import { mimeTypeForCaptureUri } from "../screenshotManager";

function logShareError(tag: string, e: unknown): void {
  const err = e as { message?: string; error?: string; [k: string]: unknown };
  const msg = err?.message ?? err?.error ?? String(e);
  console.error(`[ShapeDrawingModal:CAPTURE] ${tag}:`, msg, err);
}

function normalizeFileUri(uri: string): string {
  const u = String(uri || "").trim();
  if (!u) return u;
  if (u.startsWith("file://")) return u;
  if (u.startsWith("/")) return `file://${u}`;
  return u;
}

/** Paylaşım için cache'e kopyala — app-private yollar Android'de hedef uygulamalara açılmaz. */
async function prepareShareUris(fileUris: string[]): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < fileUris.length; i++) {
    const normalized = normalizeFileUri(fileUris[i]);
    const path = normalized.replace(/^file:\/\//, "");
    const exists = await RNFS.exists(path);
    if (!exists) {
      throw new Error("Paylaşılacak dosya bulunamadı");
    }
    const lower = path.toLowerCase();
    const ext = lower.includes(".png") ? "png" : "jpg";
    const cachePath = `${RNFS.CachesDirectoryPath}/pp_share_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
    await RNFS.copyFile(path, cachePath);
    out.push(`file://${cachePath}`);
  }
  return out;
}

export async function shareManyImages(fileUris: string[]): Promise<{ ok: boolean; error?: string }> {
  if (!fileUris.length) {
    return { ok: false, error: "Paylaşılacak görsel yok" };
  }

  let shareUris: string[];
  try {
    shareUris = await prepareShareUris(fileUris);
  } catch (e) {
    logShareError("shareManyImages prepare", e);
    return { ok: false, error: "Görseller hazırlanamadı." };
  }

  try {
    const mime = mimeTypeForCaptureUri(shareUris[0]);
    if (shareUris.length === 1) {
      await Share.open({
        url: shareUris[0],
        type: mime,
        title: "ProParcel",
        filename: "ProParcel.jpg",
        failOnCancel: false,
      });
    } else {
      await Share.open({
        urls: shareUris,
        type: mime,
        title: "ProParcel",
        filenames: shareUris.map((_, i) => `ProParcel_${i + 1}.jpg`),
        failOnCancel: false,
      });
    }
    return { ok: true };
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message;
    if (msg === "User did not share") {
      return { ok: false };
    }
    logShareError("shareManyImages", e);
    return { ok: false, error: msg ?? "Paylaşım başarısız" };
  }
}
