import { userFacingPipelineDetail } from "../src/constants/aiDroneProductionPipeline";
import type { RunwayStatusResponse } from "./droneRunwayStatusParser";

/** Runway status poll — slot bazlı ilerleme (GET /api/drone-recording-runway/status/) */
export type RunwaySlotProgressEntry = {
  step?: string;
  label?: string;
  detail?: string;
  progress_percent?: number;
  segment_slot?: number;
  segment_total?: number;
};

export type RunwaySlotProgressMap = Record<string, RunwaySlotProgressEntry>;

export type MergedRunwaySlotProgress = {
  slot: number;
  step: string;
  percent: number;
  label: string;
};

export type RunwayPollStatus = RunwayStatusResponse & {
  segmentSlotProgress?: RunwaySlotProgressMap;
};

export function normalizeRunwayProgressPercent(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const scaled = n >= 0 && n <= 1 ? n * 100 : n;
  if (scaled < 0 || scaled > 100) return null;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

/** "Frame hazırlanıyor 3/3" veya "Frame hazır 3/3" */
export function parseRunwayFrameCounts(label: string | undefined | null): { done: number; total: number } | null {
  const match = String(label || "").match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return null;
  const done = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isFinite(done) || !Number.isFinite(total) || total < 1) return null;
  return { done, total };
}

export function finalizeAllRunwaySlots(
  bySlot: Record<string, MergedRunwaySlotProgress>,
  slotCount: number,
  label = "Tamamlandı",
): void {
  const slots = Math.max(1, Math.min(8, slotCount));
  for (let slot = 1; slot <= slots; slot += 1) {
    bySlot[String(slot)] = { slot, step: "done", percent: 100, label };
  }
}

/** Runway kareleri bitti; merge/voice veya n/n label — slot yüzdeleri %100 */
export function shouldFinalizeRunwaySlotsFromPoll(poll: RunwayPollStatus, slotCount: number): boolean {
  const main = poll.progress;
  const step = String(main?.step || "").trim().toLowerCase();
  if (step === "merge" || step === "voice" || step === "done" || step === "ready") {
    return true;
  }
  const state = String(poll.state || "").trim().toUpperCase();
  if (poll.ready && (state === "SUCCESS" || step === "done" || step === "ready")) {
    return true;
  }
  if (step === "runway") {
    const counts = parseRunwayFrameCounts(main?.label);
    if (counts && counts.done >= counts.total) return true;
  }
  return false;
}

export function mergeRunwaySlotProgressEntry(
  prev: MergedRunwaySlotProgress | undefined,
  raw: RunwaySlotProgressEntry | undefined,
  slot: number,
): MergedRunwaySlotProgress {
  const rawStep = String(raw?.step || prev?.step || "").trim().toLowerCase();
  let step = rawStep;
  if (step === "openai_refs" || step === "openai_ready") {
    step = "runway";
  }
  const percentRaw = normalizeRunwayProgressPercent(
    raw?.progress_percent ?? (raw as { progress?: number })?.progress ?? prev?.percent,
  );
  const percent =
    rawStep === "openai_ready" || step === "done" || step === "ready"
      ? 100
      : percentRaw != null
        ? percentRaw
        : prev?.percent ?? 0;
  const label = userFacingPipelineDetail(
    String(raw?.label || prev?.label || "").trim(),
    step === "runway" ? "Video karesi hazırlanıyor…" : prev?.label || "Bekleniyor",
  );
  return { slot, step, percent, label };
}

export function initialRunwaySlotProgressMap(slotCount: number): Record<string, MergedRunwaySlotProgress> {
  const n = Math.max(1, Math.min(8, slotCount));
  const out: Record<string, MergedRunwaySlotProgress> = {};
  for (let slot = 1; slot <= n; slot += 1) {
    out[String(slot)] = { slot, step: "queued", percent: 0, label: "Bekleniyor" };
  }
  return out;
}

/** segment_slot_progress + ana progress.segment_slot birleştir */
export function mergeRunwaySlotProgressFromPoll(
  prev: Record<string, MergedRunwaySlotProgress>,
  poll: RunwayPollStatus,
  slotCount: number,
): Record<string, MergedRunwaySlotProgress> {
  const slots = Math.max(1, Math.min(8, slotCount));
  const next: Record<string, MergedRunwaySlotProgress> = { ...prev };
  for (let slot = 1; slot <= slots; slot += 1) {
    const key = String(slot);
    if (!next[key]) {
      next[key] = { slot, step: "queued", percent: 0, label: "Bekleniyor" };
    }
  }
  const remote = poll.segmentSlotProgress ?? poll.segment_slot_progress;
  if (remote && typeof remote === "object") {
    for (const [key, raw] of Object.entries(remote)) {
      const slot = Number(key);
      if (!Number.isFinite(slot) || slot <= 0) continue;
      next[String(slot)] = mergeRunwaySlotProgressEntry(next[String(slot)], raw, slot);
    }
  }
  const main = poll.progress;
  const mainSlot = Number(main?.segment_slot || 0);
  if (mainSlot > 0 && main) {
    next[String(mainSlot)] = mergeRunwaySlotProgressEntry(next[String(mainSlot)], main, mainSlot);
  }
  const label = String(main?.label || "").trim();
  if (label && Object.keys(remote || {}).length === 0) {
    applyAggregateFrameLabelToSlots(next, label, slots);
  }
  if (shouldFinalizeRunwaySlotsFromPoll(poll, slots)) {
    finalizeAllRunwaySlots(next, slots);
  }
  return next;
}

/** Backend henüz slot yüzdesi yazmadığında "Frame hazırlanıyor 2/3" gibi metinden tahmin */
export function applyAggregateFrameLabelToSlots(
  bySlot: Record<string, MergedRunwaySlotProgress>,
  label: string,
  slotCount: number,
): void {
  const cleaned = userFacingPipelineDetail(label, "");
  if (!cleaned) return;
  const match = cleaned.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return;
  const done = Math.max(0, Math.min(slotCount, Number(match[1]) || 0));
  const total = Math.max(1, Math.min(8, Number(match[2]) || slotCount));
  for (let slot = 1; slot <= slotCount; slot += 1) {
    const key = String(slot);
    const prev = bySlot[key] || { slot, step: "queued", percent: 0, label: "Bekleniyor" };
    if (prev.percent >= 100 && prev.step === "done") continue;
    if (slot <= done) {
      bySlot[key] = { ...prev, step: "done", percent: 100, label: "Tamamlandı" };
    } else if (slot === done + 1 && done < total) {
      bySlot[key] = {
        ...prev,
        step: "runway",
        percent: Math.max(prev.percent, 15),
        label: cleaned || "Video karesi hazırlanıyor…",
      };
    }
  }
}

export function formatRunwaySlotProgressSummary(
  bySlot: Record<string, MergedRunwaySlotProgress>,
  slotCount: number,
): string {
  const slots = Math.max(1, Math.min(8, slotCount));
  let done = 0;
  let sum = 0;
  for (let slot = 1; slot <= slots; slot += 1) {
    const entry = bySlot[String(slot)];
    const pct = entry?.percent ?? 0;
    sum += pct;
    if (pct >= 100 || entry?.step === "done" || entry?.step === "openai_ready") done += 1;
  }
  const avg = Math.round(sum / slots);
  if (done >= slots) return "Tüm kareler hazır";
  return `${done}/${slots} kare tamamlandı · ortalama %${avg}`;
}

export function toPipelineSlotProgressItems(
  bySlot: Record<string, MergedRunwaySlotProgress>,
  slotCount: number,
): Array<{
  slot: number;
  percent: number;
  status: "pending" | "active" | "done" | "failed";
  label: string;
}> {
  const slots = Math.max(1, Math.min(8, slotCount));
  return toPipelineSlotProgressItemsForSlots(
    bySlot,
    Array.from({ length: slots }, (_, i) => i + 1),
  );
}

export function toPipelineSlotProgressItemsForSlots(
  bySlot: Record<string, MergedRunwaySlotProgress>,
  slotNumbers: number[],
): Array<{
  slot: number;
  percent: number;
  status: "pending" | "active" | "done" | "failed";
  label: string;
}> {
  return slotNumbers.map((slot) => {
    const entry = bySlot[String(slot)] || { slot, step: "queued", percent: 0, label: "Bekleniyor" };
    const step = String(entry.step || "").toLowerCase();
    let status: "pending" | "active" | "done" | "failed" = "pending";
    if (step === "failed") status = "failed";
    else if (entry.percent >= 100 || step === "done" || step === "openai_ready" || step === "ready") {
      status = "done";
    } else if (entry.percent > 0 || (step && step !== "queued" && step !== "pending")) {
      status = "active";
    }
    return {
      slot,
      percent: entry.percent,
      status,
      label: entry.label,
    };
  });
}

export function initialRunwaySlotProgressForSlot(slot: number): Record<string, MergedRunwaySlotProgress> {
  const n = Math.max(1, Math.min(8, slot));
  return {
    [String(n)]: { slot: n, step: "queued", percent: 0, label: "Bekleniyor" },
  };
}
