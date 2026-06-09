import { latLonToLocalMetres } from "./geoLocalMetres";
import type { ArReferencePoints, MapReferencePoints } from "../types/mapReferencePoints";
import type { VrCalibrationMode } from "../types/vrCalibrationMode";
import type { CalibrationTransform } from "../types/calibrationTransform";

type Point2 = { x: number; y: number };

function toGeoLocalFromUser(mapRefs: MapReferencePoints): Point2[] {
  const origin = mapRefs.userPoint;
  return [
    { x: 0, y: 0 },
    (() => {
      const p = latLonToLocalMetres(mapRefs.referenceA, origin);
      return { x: p.east, y: p.north };
    })(),
    (() => {
      const p = latLonToLocalMetres(mapRefs.referenceB, origin);
      return { x: p.east, y: p.north };
    })(),
  ];
}

function toArXZ(arRefs: ArReferencePoints): Point2[] {
  return [
    { x: arRefs.userPoint.x, y: arRefs.userPoint.z },
    { x: arRefs.referenceA.x, y: arRefs.referenceA.z },
    { x: arRefs.referenceB.x, y: arRefs.referenceB.z },
  ];
}

/** 2D similarity transform (Kabsch/Umeyama) geo EN -> AR XZ */
function fitSimilarityTransform(source: Point2[], target: Point2[]): {
  rotationRad: number;
  scale: number;
  translation: Point2;
} {
  const n = source.length;
  let srcCx = 0;
  let srcCy = 0;
  let tgtCx = 0;
  let tgtCy = 0;
  for (let i = 0; i < n; i += 1) {
    srcCx += source[i].x;
    srcCy += source[i].y;
    tgtCx += target[i].x;
    tgtCy += target[i].y;
  }
  srcCx /= n;
  srcCy /= n;
  tgtCx /= n;
  tgtCy /= n;

  let num = 0;
  let den = 0;
  let srcVar = 0;
  for (let i = 0; i < n; i += 1) {
    const sx = source[i].x - srcCx;
    const sy = source[i].y - srcCy;
    const tx = target[i].x - tgtCx;
    const ty = target[i].y - tgtCy;
    num += sx * ty - sy * tx;
    den += sx * tx + sy * ty;
    srcVar += sx * sx + sy * sy;
  }

  const rotationRad = Math.atan2(num, den);
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);

  let scaleNum = 0;
  for (let i = 0; i < n; i += 1) {
    const sx = source[i].x - srcCx;
    const sy = source[i].y - srcCy;
    const rx = cos * sx - sin * sy;
    const ry = sin * sx + cos * sy;
    const tx = target[i].x - tgtCx;
    const ty = target[i].y - tgtCy;
    scaleNum += rx * tx + ry * ty;
  }
  let scale = srcVar > 1e-6 ? scaleNum / srcVar : 1;
  scale = Math.max(0.5, Math.min(2, scale));

  const translation = {
    x: tgtCx - scale * (cos * srcCx - sin * srcCy),
    y: tgtCy - scale * (sin * srcCx + cos * srcCy),
  };

  return { rotationRad, scale, translation };
}

function computeQualityScore(geo: Point2[], ar: Point2[], scale: number): number {
  const distGeo = Math.hypot(geo[1].x - geo[0].x, geo[1].y - geo[0].y);
  const distAr = Math.hypot(ar[1].x - ar[0].x, ar[1].y - ar[0].y);
  const distScore = distGeo >= 5 ? 1 : distGeo >= 3 ? 0.7 : 0.35;
  const scaleScore = scale > 0.75 && scale < 1.35 ? 1 : 0.5;
  const cross =
    (geo[1].x - geo[0].x) * (geo[2].y - geo[0].y) -
    (geo[2].x - geo[0].x) * (geo[1].y - geo[0].y);
  const collinearScore = Math.abs(cross) > 2 ? 1 : 0.3;
  return Math.max(0, Math.min(1, distScore * 0.45 + scaleScore * 0.25 + collinearScore * 0.3));
}

export function computeThreePointCalibrationTransform(
  mapRefs: MapReferencePoints,
  arRefs: ArReferencePoints,
  mode: VrCalibrationMode,
): CalibrationTransform {
  const geo = toGeoLocalFromUser(mapRefs);
  const ar = toArXZ(arRefs);
  const fit = fitSimilarityTransform(geo, ar);
  const rotationYaw = (fit.rotationRad * 180) / Math.PI;
  const qualityScore = computeQualityScore(geo, ar, fit.scale);

  return {
    originLat: mapRefs.userPoint.lat,
    originLon: mapRefs.userPoint.lon,
    rotationYawRad: fit.rotationRad,
    rotationYaw,
    translationX: fit.translation.x,
    translationY: arRefs.userPoint.y,
    translationZ: fit.translation.y,
    scale: fit.scale,
    qualityScore,
    accuracyScore: qualityScore,
    mode,
    mapReferences: mapRefs,
    createdAt: new Date().toISOString(),
  };
}

export function applyManualFineTune(
  transform: CalibrationTransform,
  dx: number,
  dz: number,
  dyawDeg: number,
): CalibrationTransform {
  return {
    ...transform,
    fineTuneEastM: (transform.fineTuneEastM ?? 0) + dx,
    fineTuneNorthM: (transform.fineTuneNorthM ?? 0) + dz,
    fineTuneYawDeg: (transform.fineTuneYawDeg ?? 0) + dyawDeg,
    rotationYaw: transform.rotationYaw + dyawDeg,
    rotationYawRad: (transform.rotationYawRad ?? 0) + (dyawDeg * Math.PI) / 180,
    translationX: transform.translationX + dx,
    translationZ: transform.translationZ + dz,
  };
}

export function geoLocalToArWorld(
  east: number,
  north: number,
  transform: CalibrationTransform,
): { x: number; y: number; z: number } {
  const eastAdj = east + (transform.fineTuneEastM ?? 0);
  const northAdj = north + (transform.fineTuneNorthM ?? 0);
  const rad = transform.rotationYawRad ?? (transform.rotationYaw * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const sx = eastAdj * transform.scale;
  const sy = northAdj * transform.scale;
  const x = cos * sx - sin * sy + transform.translationX;
  const z = sin * sx + cos * sy + transform.translationZ;
  return { x, y: transform.translationY, z };
}
