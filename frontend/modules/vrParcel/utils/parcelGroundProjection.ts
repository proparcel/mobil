import { latLonToLocalMetres } from "./geoLocalMetres";
import type { CalibrationTransform } from "../types/calibrationTransform";
import type { VrLatLon } from "../types/vrParcelPayload";

export type ScreenPoint = {
  x: number;
  y: number;
  visible: boolean;
  behind: boolean;
};

export type ProjectedEdge = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  visible: boolean;
};

export type GroundProjectionParams = {
  polygon: VrLatLon[];
  userLat: number;
  userLon: number;
  deviceHeadingDeg: number;
  transform: CalibrationTransform;
  screenW: number;
  screenH: number;
  cameraHeightM?: number;
  fovDeg?: number;
};

const DEFAULT_CAMERA_HEIGHT_M = 1.45;
const DEFAULT_FOV_DEG = 58;

function normalizeHeading(deg: number): number {
  let h = deg % 360;
  if (h < 0) h += 360;
  return h;
}

function projectGroundPoint(
  east: number,
  north: number,
  viewHeadingDeg: number,
  screenW: number,
  screenH: number,
  cameraHeightM: number,
  fovDeg: number,
): ScreenPoint {
  const rad = (viewHeadingDeg * Math.PI) / 180;
  const sinH = Math.sin(rad);
  const cosH = Math.cos(rad);

  const forward = east * sinH + north * cosH;
  const right = east * cosH - north * sinH;
  const behind = forward < 0.35;

  const fovRad = (fovDeg * Math.PI) / 180;
  const fx = (screenW * 0.5) / Math.tan(fovRad / 2);
  const fy = fx * (screenH / screenW);

  if (behind) {
    const angle = Math.atan2(right, forward);
    const margin = 0.42;
    return {
      x: screenW * 0.5 + Math.sin(angle) * screenW * margin,
      y: screenH * 0.52 - Math.cos(angle) * screenH * margin,
      visible: true,
      behind: true,
    };
  }

  const x = screenW * 0.5 + (right / forward) * fx;
  const y = screenH * 0.52 + (-cameraHeightM / forward) * fy;
  const edgeMargin = 120;
  const visible =
    x >= -edgeMargin &&
    x <= screenW + edgeMargin &&
    y >= -edgeMargin &&
    y <= screenH + edgeMargin;

  return { x, y, visible, behind: false };
}

/**
 * Parsel sınırını kullanıcının GPS konumu + pusula yönü ile kamera düzlemine projekte eder.
 * Tap/AR çeviri ofsetleri kullanılmaz — gerçek metre + dönüş.
 */
export function projectParcelBoundaryGround(params: GroundProjectionParams): ScreenPoint[] {
  const {
    polygon,
    userLat,
    userLon,
    deviceHeadingDeg,
    transform,
    screenW,
    screenH,
    cameraHeightM = DEFAULT_CAMERA_HEIGHT_M,
    fovDeg = DEFAULT_FOV_DEG,
  } = params;

  const userOrigin: VrLatLon = { lat: userLat, lon: userLon };
  const baseHeading = transform.calibrationHeadingDeg ?? 0;
  const yawOffset = transform.rotationYaw + (transform.fineTuneYawDeg ?? 0);
  const eastShift = transform.fineTuneEastM ?? 0;
  const northShift = transform.fineTuneNorthM ?? 0;
  const viewHeadingDeg = normalizeHeading(deviceHeadingDeg - baseHeading + yawOffset);

  return polygon.map((vertex) => {
    const local = latLonToLocalMetres(vertex, userOrigin);
    const east = local.east + eastShift;
    const north = local.north + northShift;
    return projectGroundPoint(
      east,
      north,
      viewHeadingDeg,
      screenW,
      screenH,
      cameraHeightM,
      fovDeg,
    );
  });
}

export function projectParcelEdges(params: GroundProjectionParams): ProjectedEdge[] {
  const points = projectParcelBoundaryGround(params);
  const edges: ProjectedEdge[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    edges.push({
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      visible: a.visible || b.visible,
    });
  }
  return edges;
}

export function countVisibleBoundaryPoints(points: ScreenPoint[]): number {
  return points.filter((p) => p.visible && !p.behind).length;
}

export function projectCentroidLabel(
  center: VrLatLon,
  params: GroundProjectionParams,
): ScreenPoint {
  const userOrigin: VrLatLon = { lat: params.userLat, lon: params.userLon };
  const baseHeading = params.transform.calibrationHeadingDeg ?? 0;
  const yawOffset = params.transform.rotationYaw + (params.transform.fineTuneYawDeg ?? 0);
  const viewHeadingDeg = normalizeHeading(
    params.deviceHeadingDeg - baseHeading + yawOffset,
  );
  const local = latLonToLocalMetres(center, userOrigin);
  return projectGroundPoint(
    local.east + (params.transform.fineTuneEastM ?? 0),
    local.north + (params.transform.fineTuneNorthM ?? 0),
    viewHeadingDeg,
    params.screenW,
    params.screenH,
    params.cameraHeightM ?? DEFAULT_CAMERA_HEIGHT_M,
    params.fovDeg ?? DEFAULT_FOV_DEG,
  );
}
