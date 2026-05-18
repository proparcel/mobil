/**
 * 3D Model Editör – Çoklu görsel paylaşım (tek seferde)
 * message gönderilmez - sadece resimler paylaşılır.
 * Android'de file:// (app internal) diğer uygulamalara açılmadığı için çoklu paylaşımda
 * dosyalar base64 data URL'ye çevrilip Share.open(urls) ile tek seferde paylaştırılır.
 */

import { Platform } from "react-native";
import Share from "react-native-share";
import RNFS from "react-native-fs";

const SHARE_OPEN_TIMEOUT_MS = 15000;

function logShareError(tag: string, e: unknown): void {
  const err = e as { message?: string; error?: string; [k: string]: unknown };
  const msg = err?.message ?? err?.error ?? String(e);
  console.error(`[ShapeDrawingModal:CAPTURE] ${tag}:`, msg, err);
}

/** file:// URI listesini Android için base64 data URL listesine çevirir (tek seferde paylaşım). */
async function fileUrisToDataUrls(fileUris: string[]): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < fileUris.length; i++) {
    const uri = fileUris[i];
    const path = uri.startsWith("file://") ? uri.replace("file://", "") : uri;
    try {
      const base64 = await RNFS.readFile(path, "base64");
      out.push(`data:image/jpeg;base64,${base64}`);
    } catch (e) {
      console.warn("[ShapeDrawingModal:CAPTURE] fileUrisToDataUrls: dosya okunamadı", path, e);
      throw e;
    }
  }
  return out;
}

export async function shareManyImages(fileUris: string[]): Promise<{ ok: boolean; error?: string }> {
  const isAndroid = Platform.OS === "android";

  console.log("[ShapeDrawingModal:CAPTURE] shareManyImages: giriş, count=", fileUris.length, "platform=", Platform.OS);
  if (!fileUris.length) {
    console.warn("[ShapeDrawingModal:CAPTURE] shareManyImages: boş liste, çıkış");
    return { ok: false, error: "Paylaşılacak görsel yok" };
  }

  const buildOpts = (uris: string[]) => {
    const opts: any = {
      type: "image/jpeg",
      title: "ProParcel",
    };
    if (uris.length === 1) {
      opts.url = uris[0];
      opts.filename = "ProParcel.jpg";
    } else {
      opts.urls = uris;
      opts.filenames = uris.map((_, i) => `ProParcel_${i + 1}.jpg`);
    }
    return opts;
  };

  let shareUris = fileUris;
  if (isAndroid && fileUris.length > 0 && fileUris.every((u) => u.startsWith("file://"))) {
    try {
      console.log("[ShapeDrawingModal:CAPTURE] shareManyImages: Android file:// -> base64 data URL dönüşümü");
      shareUris = await fileUrisToDataUrls(fileUris);
      console.log("[ShapeDrawingModal:CAPTURE] shareManyImages: base64 dönüşümü tamamlandı, count=", shareUris.length);
    } catch (e) {
      logShareError("shareManyImages base64 dönüşümü", e);
      return { ok: false, error: "Görseller hazırlanamadı." };
    }
  }

  try {
    const opts = buildOpts(shareUris);
    console.log("[ShapeDrawingModal:CAPTURE] shareManyImages: Share.open çağrılıyor (tek sefer), url/urls sayısı=", shareUris.length);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Share.open timeout")), SHARE_OPEN_TIMEOUT_MS);
    });
    await Promise.race([Share.open(opts), timeoutPromise]);
    console.log("[ShapeDrawingModal:CAPTURE] shareManyImages: Share.open başarılı");
    return { ok: true };
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message;
    console.log("[ShapeDrawingModal:CAPTURE] shareManyImages: catch, message=", msg);
    if (msg === "Share.open timeout") {
      console.warn("[ShapeDrawingModal:CAPTURE] shareManyImages: timeout");
      return { ok: false, error: "Paylaşım zaman aşımı." };
    }
    if (msg === "User did not share") {
      return { ok: false };
    }
    logShareError("shareManyImages", e);
    return { ok: false, error: (e as { message?: string })?.message ?? "Paylaşım başarısız" };
  }
}
