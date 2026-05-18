/**
 * Hisseli Parsel Bölme ekranı veri tipleri.
 */

export type Point = { x: number; y: number };

export type Polygon = { type: "Polygon"; ring: Point[] };

export type PolygonEdge = {
  edgeId: string;
  i: number;
  a: Point;
  b: Point;
  mid: Point;
  length: number;
  bbox: { minX: number; maxX: number; minY: number; maxY: number };
};

export type Piece = {
  id: string;
  polygon: Polygon;
  area: number;
  frontageLen?: number;
  violations: string[];
  valid: boolean;
};

export type LineString = { type: "LineString"; coords: Point[] };

export type SplitProfile = "arsa" | "tarla";
export type SplitMode = "by_area" | "by_count";
export type Orientation = "vertical" | "horizontal" | "auto";

export type UiMode = "pan_zoom" | "select_road_edges" | "select_piece" | "edge_slide" | "draw_road" | "road_slide";

/** Yol çiz modu alt seçenekleri. freehand = serbest çizim (DrawBar görünür). */
export type RoadDrawSubMode = "none" | "vertical" | "horizontal" | "edge" | "freehand";

/** Yol kaydırma handle türü: vertex (tek nokta) veya segment (tüm yol paralel). */
export type RoadHandleType = "vertex" | "segment";

export type RoadHandleSelection = { type: RoadHandleType; index: number } | null;

export type SplitStatus =
  | "INIT"
  | "CONFIG_EDIT"
  | "CALCULATING"
  | "READY"
  | "MANUAL_TWEAK";

export type ViewTransform = {
  scale: number;
  translateX: number;
  translateY: number;
};

export type RuleSet = {
  minArea: number;
  areaToleranceRatio: number;
  requireRoadFrontage: boolean;
  minFrontage: number;
};
