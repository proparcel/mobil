/**
 * Ana ekrandan VR modülüne aktarılan ham parsel verisi.
 * index.tsx ParcelData ile uyumlu minimal şekil.
 */
export type VrParcelSource = {
  id?: string;
  geometry?: {
    type?: string;
    coordinates?: unknown;
  } | null;
  properties?: Record<string, unknown> | null;
  analysisData?: unknown | null;
};
