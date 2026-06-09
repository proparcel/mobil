import type { VrCalibrationStep } from "../types/vrCalibrationStep";

export type VrStepPhase = "intro" | "map" | "ar" | "review" | "drawn";

export type VrStepMeta = {
  phase: VrStepPhase;
  index: number;
  total: number;
  title: string;
  hint: string;
};

const STEP_SEQUENCE: VrCalibrationStep[] = [
  "mode_intro",
  "map_user",
  "map_ref_a",
  "map_ref_b",
  "unity_required",
  "ar_user",
  "ar_ref_a",
  "ar_ref_b",
  "review",
  "drawn",
];

const STEP_META: Record<VrCalibrationStep, Omit<VrStepMeta, "index" | "total">> = {
  mode_intro: {
    phase: "intro",
    title: "Kalibrasyona hazırlık",
    hint: "Haritada konumunuzu ve iki sabit hedefi işaretleyeceksiniz; ardından kamerada aynı noktaları işaretleyeceksiniz.",
  },
  map_user: {
    phase: "map",
    title: "Harita — Konumunuz",
    hint: "Haritada bulunduğunuz noktayı işaretleyin.",
  },
  map_ref_a: {
    phase: "map",
    title: "Harita — Hedef A",
    hint: "Kamerada görebileceğiniz sabit Hedef A'yı haritada işaretleyin (konumunuzdan en az 3 m).",
  },
  map_ref_b: {
    phase: "map",
    title: "Harita — Hedef B",
    hint: "Kamerada görebileceğiniz sabit Hedef B'yi haritada işaretleyin (diğer noktalardan en az 3 m).",
  },
  unity_required: {
    phase: "intro",
    title: "Unity AR gerekli",
    hint: "Parsel çizimi AR world içinde sabit kalmalıdır.",
  },
  ar_user: {
    phase: "ar",
    title: "AR — Konumunuz",
    hint: "Kamerada ayaklarınızın olduğu zemine dokunun.",
  },
  ar_ref_a: {
    phase: "ar",
    title: "AR — Hedef A",
    hint: "Kamerada Hedef A'yı işaretleyin (konumunuzdan en az 3 m uzakta).",
  },
  ar_ref_b: {
    phase: "ar",
    title: "AR — Hedef B",
    hint: "Kamerada Hedef B'yi işaretleyin (Hedef A'dan en az 3 m uzakta).",
  },
  review: {
    phase: "review",
    title: "Kalibrasyon özeti",
    hint: "Kalibrasyon tamamlandı. Parseli çizebilirsiniz.",
  },
  drawn: {
    phase: "drawn",
    title: "Parsel yerleştirildi",
    hint: "Parsel görünümü hazır. İnce ayar yapabilir veya kilitleyebilirsiniz.",
  },
};

export function getVrStepMeta(step: VrCalibrationStep): VrStepMeta {
  const index = Math.max(0, STEP_SEQUENCE.indexOf(step));
  return {
    ...STEP_META[step],
    index: index + 1,
    total: STEP_SEQUENCE.length,
  };
}

export function getVrPhaseProgress(step: VrCalibrationStep): number {
  const meta = getVrStepMeta(step);
  return meta.index / meta.total;
}
