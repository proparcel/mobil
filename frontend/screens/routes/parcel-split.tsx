/**
 * Hisseli Parsel Bölme ekranı.
 * Beyaz canvas, pan/pinch/tap, parent polygon, edge picking; alt panel plana göre genişletilir.
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useSharedValue } from "react-native-reanimated";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Alert,
  LayoutChangeEvent,
  BackHandler,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScreenShield } from "../contexts/ScreenShieldContext";
import { useRouter, useLocalSearchParams, useRoute } from "../../src/hooks/useNavigation";
import Ionicons from "react-native-vector-icons/Ionicons";
import { normalizeToRing, lonLatToLocalMeters } from "../../src/utils/parcelSplitTransform";
import {
  buildEdges,
  computeSplitMultiTotalCount,
  polygonArea,
  pointInPolygon,
  findAdjacentPieces,
  mergePieces,
  findNeighborSharingEdge,
  findSharedEdgeIndexInPieceA,
  deriveSplitLinesFromPieces,
  pickNearestRoadSegment,
  pickNearestVertex,
  pickNearestSegmentHandle,
} from "../../src/utils/parcelSplitEngine";
import { getBbox } from "../../src/utils/parcelSplitTransform";
import { updateTwoPiecesBySlidingEdge, updateTwoPiecesBySlidingEdgeVertex } from "../../src/utils/edgeSlideGeometry";
import {
  Canvas2D,
  type Canvas2DHandle,
} from "../../components/app/parcelSplit/Canvas2D";
import { ActionBar } from "../../components/app/parcelSplit/ActionBar";
import { RoadModeBar } from "../../components/app/parcelSplit/modebars/RoadModeBar";
import { RoadQuickPanel } from "../../components/app/parcelSplit/RoadQuickPanel";
import { EdgeSlideModeBar } from "../../components/app/parcelSplit/modebars/EdgeSlideModeBar";
import { RoadSlideModeBar } from "../../components/app/parcelSplit/modebars/RoadSlideModeBar";
import { EdgeRoadModeBar } from "../../components/app/parcelSplit/modebars/EdgeRoadModeBar";
import { StatsChip } from "../../components/app/parcelSplit/StatsChip";
import { PieceListBottomSheet } from "../../components/app/parcelSplit/PieceListBottomSheet";
import { MergeNeighborBottomSheet } from "../../components/app/parcelSplit/MergeNeighborBottomSheet";
import { FloatingTools } from "../../components/app/parcelSplit/FloatingTools";
import { HelpBottomSheet } from "../../components/app/parcelSplit/HelpBottomSheet";
import { AyarlarBottomSheet } from "../../components/app/parcelSplit/AyarlarBottomSheet";
import { PieceDetailModal } from "../../components/app/parcelSplit/PieceDetailModal";
import { ParcelSplitPurchaseModal } from "../../components/app/parcelSplit/ParcelSplitPurchaseModal";
import { PdfRenderCanvas } from "../../components/app/parcelSplit/PdfRenderCanvas";
import { parcelSplitTheme } from "../../components/app/parcelSplit/theme";
import type {
  UiMode,
  RoadDrawSubMode,
  SplitProfile,
  SplitMode,
  Orientation,
  Piece,
  LineString,
  RoadHandleSelection,
  EdgeRoadDraft,
} from "../../src/types/parcelSplit";
import type { Point } from "../../src/types/parcelSplit";
import { createEdgeMeasurementFeatures, type EdgeMeasureData } from "../../src/utils/edgeMeasurementsManager";
import { moveSegmentLabelsOutside, type MetreEdgeFeature } from "../../components/app/parcelSplit/LayerEdgeMeasurements";
import { API_URL } from "../../config/api";
import {
  buildRoadBufferPolygon,
  extendPolylineToBoundary,
  intersectRoadWithParent,
  subtractRoadFromParent,
  closestPointOnRing,
  clipPolylineToRing,
  createVerticalCenterline,
  createHorizontalCenterline,
  createEdgeParallelCenterline,
  createEdgeParallelBaseLine,
} from "../../src/utils/roadGeometry";
import {
  computeMergeCandidate,
  mergeRoads,
  appendRoadsByClosestEndpoints,
  type RoadMergePreview,
} from "../../src/utils/roadMerge";
import { translateRoadParallel, moveRoadVertex } from "../../src/utils/roadSlideGeometry";
import ViewShot from "react-native-view-shot";
import Share from "react-native-share";
import { computeEdgeLengths, generateParcelSplitPdf } from "../../src/utils/parcelSplitPdf";
import { addSavedParcelSplitProject } from "../../src/utils/savedParcelSplitProjects";
import {
  isParcelSplitPurchased,
  setParcelSplitPurchased,
} from "../../src/utils/parcelSplitPurchasedStorage";

const { width: VIEW_WIDTH } = Dimensions.get("window");

/** mahalle, ada, parsel ile dosya adı üretir (mahalle_ada_parsel.pdf). */
function parcelSplitFileName(mahalle?: string, ada?: string, parsel?: string): string {
  const m = String(mahalle ?? "").trim().replace(/\s+/g, "_").replace(/[<>:"/\\|?*]/g, "") || "mahalle";
  const a = String(ada ?? "").trim().replace(/[<>:"/\\|?*]/g, "") || "0";
  const p = String(parsel ?? "").trim().replace(/[<>:"/\\|?*]/g, "") || "0";
  return `${m}_${a}_${p}.pdf`;
}

/** Ring merkezi (son nokta kapatma hariç). */
function ringCentroid(r: Point[]): Point {
  let cx = 0, cy = 0;
  const n = r.length - 1;
  if (n <= 0) return r[0] ?? { x: 0, y: 0 };
  for (let i = 0; i < n; i++) {
    cx += r[i].x;
    cy += r[i].y;
  }
  return { x: cx / n, y: cy / n };
}

/** EdgeMeasurementFeature (lon/lat) → MetreEdgeFeature (local metre). Segment'ler midpoint + edgeIndex ile çıkar; placement Canvas2D'de screen-space collision ile yapılır. */
function edgeFeaturesToMetre(
  features: Array<{ geometry: { type: string; coordinates: number[] | number[][] }; properties: { kind: string; text?: string; color?: string; edgeIndex?: number } }>,
  originMeters: Point,
  ringMetre: Point[] | null = null
): MetreEdgeFeature[] {
  const out: MetreEdgeFeature[] = [];
  let segmentPointIndexFallback = 0;
  for (const f of features) {
    if (f.geometry.type === "LineString" && Array.isArray(f.geometry.coordinates)) {
      const coords = (f.geometry.coordinates as [number, number][]).map(([lon, lat]) =>
        lonLatToLocalMeters(lon, lat, originMeters)
      );
      out.push({ kind: f.properties.kind as "bbox" | "segment", type: "LineString", coords, color: f.properties.color });
    } else if (f.geometry.type === "Point" && Array.isArray(f.geometry.coordinates) && f.geometry.coordinates.length >= 2) {
      const [lon, lat] = f.geometry.coordinates as [number, number];
      let coords = lonLatToLocalMeters(lon, lat, originMeters);
      let angle: number | undefined;
      let edgeIndex: number | undefined;
      if (f.properties.kind === "segment" && ringMetre && ringMetre.length >= 3) {
        edgeIndex = typeof f.properties.edgeIndex === "number" ? f.properties.edgeIndex : segmentPointIndexFallback++;
        const n = ringMetre.length;
        const a = ringMetre[edgeIndex % n];
        const b = ringMetre[(edgeIndex + 1) % n];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        coords = { x: midX, y: midY };
        angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      }
      out.push({
        kind: f.properties.kind as "segment" | "main_edge",
        type: "Point",
        coords,
        text: f.properties.text ?? "",
        color: f.properties.color,
        ...(angle != null && { angle }),
        ...(edgeIndex != null && { edgeIndex }),
      });
    }
  }
  return out;
}

export default function ParcelSplitScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    parentPolygon?: string | object;
    roadLines?: string;
    parcelId?: string;
    profileDefault?: string;
    mahalle?: string;
    ada?: string;
    parsel?: string;
  }>();
  const route = useRoute();
  const parentPolygonRaw = params.parentPolygon ?? (route.params as Record<string, unknown>)?.parentPolygon;

  const normalizeResult = useMemo(() => normalizeToRing(parentPolygonRaw), [parentPolygonRaw]);
  const ring = normalizeResult?.ring ?? null;
  const originMeters = normalizeResult?.originMeters ?? null;

  useEffect(() => {
    if (!__DEV__) return;
    if (!ring || ring.length < 3) {
      console.log("[ParcelSplit] POLIGON YOK – ring yok veya < 3 nokta");
      console.log("[ParcelSplit] ring YOK", {
        parentPolygonRawType: typeof parentPolygonRaw,
        parentPolygonRawPreview:
          typeof parentPolygonRaw === "string"
            ? parentPolygonRaw.slice(0, 80)
            : parentPolygonRaw,
        normalizedLength: ring?.length ?? 0,
      });
    } else {
      const bbox = getBbox(ring);
      const spanX = bbox.maxX - bbox.minX;
      const spanY = bbox.maxY - bbox.minY;
      const spanXNaN = !Number.isFinite(spanX);
      const spanYNaN = !Number.isFinite(spanY);
      const bboxNaN = [bbox.minX, bbox.maxX, bbox.minY, bbox.maxY].some((n) => !Number.isFinite(n));
      console.log("[ParcelSplit] ring VAR (local metre)", {
        pointCount: ring.length,
        bbox: { minX: bbox.minX, maxX: bbox.maxX, minY: bbox.minY, maxY: bbox.maxY },
        spanX,
        spanY,
        spanXNaN,
        spanYNaN,
        bboxNaN,
        first: ring[0],
        last: ring[ring.length - 1],
        originMeters,
      });
    }
  }, [ring, originMeters, parentPolygonRaw]);
  const edges = useMemo(() => (ring && ring.length >= 3 ? buildEdges(ring) : []), [ring]);

  const [selectedRoadEdges, setSelectedRoadEdges] = useState<Set<string>>(new Set());
  const [uiMode, setUiMode] = useState<UiMode>("pan_zoom");
  const [profile, setProfile] = useState<SplitProfile>(
    (params.profileDefault as SplitProfile) || "tarla"
  );
  const [mode, setMode] = useState<SplitMode>("by_count");
  const [targetArea, setTargetArea] = useState("");
  const [targetCount, setTargetCount] = useState("2");
  const [orientation, setOrientation] = useState<Orientation>("vertical");
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [splitLines, setSplitLines] = useState<LineString[]>([]);
  const [fixedCuts, setFixedCuts] = useState<number[]>([]);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [detailModalPiece, setDetailModalPiece] = useState<Piece | null>(null);
  const [pieceListVisible, setPieceListVisible] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [showEdgeMeasurements, setShowEdgeMeasurements] = useState(false);
  const [parentEdgeMeasurementsMetre, setParentEdgeMeasurementsMetre] = useState<MetreEdgeFeature[] | null>(null);
  const [settingsSheetVisible, setSettingsSheetVisible] = useState(false);
  const [historyStack, setHistoryStack] = useState<{ pieces: Piece[]; splitLines: LineString[]; fixedCuts: number[]; selectedPieceId: string | null }[]>([]);
  const [deletedPiece, setDeletedPiece] = useState<Piece | null>(null);
  const [mergeNeighborVisible, setMergeNeighborVisible] = useState(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [neighborPieceId, setNeighborPieceId] = useState<string | null>(null);
  const [edgeSlideBaseSnapshot, setEdgeSlideBaseSnapshot] = useState<{
    pieces: Piece[];
    baseAreaA: number;
    baseAreaB: number;
    fixedParentRing: Point[] | null;
  } | null>(null);
  const [edgeSlideStep, setEdgeSlideStepRaw] = useState<number>(1);
  const setEdgeSlideStep = useCallback((v: number) => {
    const n = Number(v);
    setEdgeSlideStepRaw(Number.isFinite(n) ? Math.max(0.001, Math.min(100, n)) : 1);
  }, []);
  const [edgeSlideClampFeedback, setEdgeSlideClampFeedback] = useState<string | null>(null);
  const [roadDraftPoints, setRoadDraftPoints] = useState<Point[]>([]);
  const [roadDraftSelectedVertex, setRoadDraftSelectedVertex] = useState<number | null>(null);
  const [roadWidthInput, setRoadWidthInput] = useState("2");
  const [roadPolygon, setRoadPolygon] = useState<Point[] | null>(null);
  const [roadCenterline, setRoadCenterline] = useState<Point[] | null>(null);
  const [baseParentsRings, setBaseParentsRings] = useState<Point[][] | null>(null);
  const [roadSelected, setRoadSelected] = useState(false);
  const [selectedRoadId, setSelectedRoadId] = useState<string | null>(null);
  const [selectedRoadHandle, setSelectedRoadHandle] = useState<RoadHandleSelection>(null);
  const [roadSlideBaseSnapshot, setRoadSlideBaseSnapshot] = useState<{
    roadCenterline: Point[];
    roadPolygon: Point[];
    baseParentsRings: Point[][];
    pieces: Piece[];
    splitLines: LineString[];
  } | null>(null);
  const [roadSlideStep, setRoadSlideStepRaw] = useState<number>(1);
  const setRoadSlideStep = useCallback((v: number) => {
    const n = Number(v);
    setRoadSlideStepRaw(Number.isFinite(n) ? Math.max(0.001, Math.min(100, n)) : 1);
  }, []);
  const [roadSlideClampFeedback, setRoadSlideClampFeedback] = useState<string | null>(null);
  const [roadDrawSubMode, setRoadDrawSubMode] = useState<RoadDrawSubMode>("none");
  const [selectedParentEdgeForRoad, setSelectedParentEdgeForRoad] = useState<number | null>(null);
  const [edgeRoadDraft, setEdgeRoadDraft] = useState<EdgeRoadDraft | null>(null);
  const [edgeRoadActiveEnd, setEdgeRoadActiveEnd] = useState<0 | 1 | null>(null);
  const [roadMergePreview, setRoadMergePreview] = useState<RoadMergePreview | null>(null);
  const selectedRoadIdRef = useRef<string | null>(null);
  const selectedRoadHandleRef = useRef<RoadHandleSelection>(null);
  const roadSlideReadySV = useSharedValue(0);
  const canvasRef = useRef<Canvas2DHandle>(null);
  const captureTargetRef = useRef<{ capture: (opts?: { format?: string; quality?: number; result?: string; width?: number; height?: number }) => Promise<string> } | null>(null);
  const pdfParentRenderRef = useRef<{ capture: (opts?: { format?: string; quality?: number; result?: string; width?: number; height?: number }) => Promise<string> } | null>(null);
  const pieceShotRefs = useRef<Array<{ capture: (opts?: { format?: string; quality?: number; result?: string; width?: number; height?: number }) => Promise<string> } | null>>([]);
  const piecesRef = useRef<Piece[]>([]);
  piecesRef.current = pieces;
  const [canvasLayout, setCanvasLayout] = useState<{ width: number; height: number }>({ width: VIEW_WIDTH, height: 0 });
  const [pdfBusy, setPdfBusy] = useState(false);

  const PDF_PARENT_W = 800;
  const PDF_PARENT_H = 500;
  const PDF_THUMB_W = 120;
  const PDF_THUMB_H = 120;
  const [hasPurchasedView, setHasPurchasedView] = useState(false);
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  /** Satın alma sonrası devam edilecek işlem: save | share | saveAndBack */
  const [pendingAction, setPendingAction] = useState<"save" | "share" | "saveAndBack" | null>(null);

  // Aynı parsel (mahalle_ada_parsel) daha önce satın alındıysa kaydet/paylaş açık olsun
  useEffect(() => {
    let cancelled = false;
    isParcelSplitPurchased(params.mahalle, params.ada, params.parsel).then((purchased) => {
      if (!cancelled && purchased) setHasPurchasedView(true);
    });
    return () => { cancelled = true; };
  }, [params.mahalle, params.ada, params.parsel]);

  // Ekran koruma: FLAG_SECURE (Android) + overlay (kayıt/screenshot). ParcelSplit odaktayken enable, çıkınca disable.
  const { enableShield, disableShield } = useScreenShield();
  useFocusEffect(
    useCallback(() => {
      enableShield();
      return () => { disableShield(); };
    }, [enableShield, disableShield])
  );

  useEffect(() => {
    if (uiMode !== "edge_slide") {
      setSelectedEdgeId(null);
      setNeighborPieceId(null);
      setEdgeSlideBaseSnapshot(null);
    }
  }, [uiMode]);

  useEffect(() => {
    if (uiMode !== "road_slide") {
      setSelectedRoadId(null);
      setSelectedRoadHandle(null);
      selectedRoadIdRef.current = null;
      selectedRoadHandleRef.current = null;
      roadSlideReadySV.value = 0;
      setRoadSlideBaseSnapshot(null);
    }
  }, [uiMode, roadSlideReadySV]);

  useEffect(() => {
    if (uiMode !== "draw_road") {
      setRoadDraftSelectedVertex(null);
      setRoadDrawSubMode("none");
      setSelectedParentEdgeForRoad(null);
      setEdgeRoadDraft(null);
      setEdgeRoadActiveEnd(null);
      setRoadMergePreview(null);
    }
  }, [uiMode]);

  useEffect(() => {
    if (uiMode === "draw_road" || uiMode === "edge_slide" || uiMode === "road_slide") {
      setShowEdgeMeasurements(false);
    }
  }, [uiMode]);

  const pushHistory = useCallback(() => {
    setHistoryStack((prev) => [...prev.slice(-9), { pieces, splitLines, fixedCuts, selectedPieceId }]);
  }, [pieces, splitLines, fixedCuts, selectedPieceId]);

  const undo = useCallback(() => {
    setHistoryStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setPieces(last.pieces);
      setSplitLines(last.splitLines);
      setFixedCuts(last.fixedCuts);
      setSelectedPieceId(last.selectedPieceId);
      setDetailModalPiece(null);
      setSelectedEdgeId(null);
      setNeighborPieceId(null);
      setEdgeSlideBaseSnapshot(null);
      setDeletedPiece(null);
      setMergeNeighborVisible(false);
      return prev.slice(0, -1);
    });
  }, []);

  const handleSelectPiece = useCallback(
    (id: string | null) => {
      setSelectedPieceId(id);
      setDetailModalPiece(id ? (pieces.find((p) => p.id === id) ?? null) : null);
    },
    [pieces]
  );

  const handleDeletePiece = useCallback(() => {
    if (!selectedPieceId) return;
    const piece = pieces.find((p) => p.id === selectedPieceId);
    if (!piece) return;
    pushHistory();
    setDeletedPiece(piece);
    setPieces((prev) => prev.filter((p) => p.id !== selectedPieceId));
    setSelectedPieceId(null);
    setDetailModalPiece(null);
    setSplitLines([]);
    setFixedCuts([]);
    setMergeNeighborVisible(true);
  }, [selectedPieceId, pieces, pushHistory]);

  const handleMergeWithNeighbor = useCallback(
    (neighborId: string) => {
      if (!deletedPiece) return;
      const neighbor = pieces.find((p) => p.id === neighborId);
      if (!neighbor) return;
      const merged = mergePieces(deletedPiece, neighbor);
      if (!merged) return;
      setPieces((prev) => prev.filter((p) => p.id !== neighborId).concat([merged]));
      setSelectedPieceId(merged.id);
      setDeletedPiece(null);
      setMergeNeighborVisible(false);
    },
    [deletedPiece, pieces]
  );

  const adjacentPiecesForMerge = useMemo(() => {
    if (!deletedPiece) return [];
    const ids = findAdjacentPieces([...pieces, deletedPiece], deletedPiece.id);
    return pieces.filter((p) => ids.includes(p.id));
  }, [pieces, deletedPiece]);

  const parentRingForClip = useMemo(() => {
    if (!ring) return null;
    if (!baseParentsRings?.length) return ring;
    const pieceA = selectedPieceId ? pieces.find((p) => p.id === selectedPieceId) : null;
    const pieceB = neighborPieceId ? pieces.find((p) => p.id === neighborPieceId) : null;
    if (!pieceA || !pieceB) return ring;
    const centroid = (r: Point[]) => {
      const n = Math.max(1, r.length - 1);
      let cx = 0, cy = 0;
      for (let i = 0; i < n; i++) {
        cx += r[i].x;
        cy += r[i].y;
      }
      return { x: cx / n, y: cy / n };
    };
    const cA = centroid(pieceA.polygon.ring);
    const cB = centroid(pieceB.polygon.ring);
    for (const r of baseParentsRings) {
      if (pointInPolygon(cA, r) && pointInPolygon(cB, r)) return r;
    }
    return baseParentsRings[0] ?? ring;
  }, [ring, baseParentsRings, pieces, selectedPieceId, neighborPieceId]);

  const pickParentRingForPieces = useCallback(
    (pieceA: Piece, pieceB: Piece): Point[] | null => {
      if (!ring) return null;
      if (!baseParentsRings?.length) return ring;
      const centroid = (r: Point[]) => {
        const n = Math.max(1, r.length - 1);
        let cx = 0, cy = 0;
        for (let i = 0; i < n; i++) {
          cx += r[i].x;
          cy += r[i].y;
        }
        return { x: cx / n, y: cy / n };
      };
      const cA = centroid(pieceA.polygon.ring);
      const cB = centroid(pieceB.polygon.ring);
      for (const r of baseParentsRings) {
        if (pointInPolygon(cA, r) && pointInPolygon(cB, r)) return r;
      }
      return baseParentsRings[0] ?? ring;
    },
    [ring, baseParentsRings]
  );

  const handleSelectEdge = useCallback(
    (edgeId: string | null) => {
      if (edgeId == null) {
        setSelectedEdgeId(null);
        setNeighborPieceId(null);
        setEdgeSlideBaseSnapshot(null);
        return;
      }
      if (!selectedPieceId) return;
      const pieceA = pieces.find((p) => p.id === selectedPieceId);
      if (!pieceA) return;
      const edgeIndex = parseInt(edgeId, 10);
      if (Number.isNaN(edgeIndex) || edgeIndex < 0 || edgeIndex >= pieceA.polygon.ring.length - 1) return;
      const neighbor = findNeighborSharingEdge(pieces, selectedPieceId, edgeIndex);
      if (!neighbor) {
        const msg = roadPolygon
          ? "Bu kenar yol sınırına ait. Yolu kaydırmak için üstteki 'Yol Kaydır' butonuna basın."
          : "Bu kenar taşınamaz; komşu parsel yok.";
        Alert.alert("Dış sınır", msg);
        setSelectedEdgeId(null);
        setNeighborPieceId(null);
        setEdgeSlideBaseSnapshot(null);
        if (__DEV__) console.log("[ParcelSplit] edge_slide: no neighbor for edge", edgeIndex);
        return;
      }
      const fixedParentRing = pickParentRingForPieces(pieceA, neighbor);
      setSelectedEdgeId(edgeId);
      setNeighborPieceId(neighbor.id);
      setEdgeSlideBaseSnapshot({
        pieces: [...pieces],
        baseAreaA: pieceA.area,
        baseAreaB: neighbor.area,
        fixedParentRing,
      });
      setEdgeSlideClampFeedback(null);
      if (__DEV__) console.log("[ParcelSplit] edge_slide: selected edge", edgeIndex, "neighbor", neighbor.id, "fixedParent");
    },
    [pieces, selectedPieceId, pickParentRingForPieces, roadPolygon]
  );

  const handleEdgeSlideBy = useCallback(
    (offsetMeters: number) => {
      if (!selectedPieceId || !neighborPieceId || !edgeSlideBaseSnapshot) return;
      const offset = offsetMeters;
      const parentRing = edgeSlideBaseSnapshot.fixedParentRing ?? parentRingForClip;
      setEdgeSlideClampFeedback(null);
      setPieces((prevPieces) => {
        const pieceA = prevPieces.find((p) => p.id === selectedPieceId);
        const pieceB = prevPieces.find((p) => p.id === neighborPieceId);
        if (!pieceA || !pieceB) return prevPieces;
        const edgeIndex = findSharedEdgeIndexInPieceA(pieceA, pieceB);
        if (edgeIndex == null) {
          if (__DEV__) console.log("[ParcelSplit] edge_slide: no shared edge found between pieces");
          return prevPieces;
        }
        let resultPieces: typeof prevPieces | null = null;
        let appliedOffset = offset;
        let wasClamped = false;
        const vertexResult = updateTwoPiecesBySlidingEdgeVertex(
          prevPieces,
          selectedPieceId,
          neighborPieceId,
          edgeIndex,
          offset,
          parentRing
        );
        if (vertexResult) {
          resultPieces = vertexResult.pieces;
          appliedOffset = vertexResult.appliedOffsetMeters;
          wasClamped = vertexResult.clamped;
        } else {
          const fallback = updateTwoPiecesBySlidingEdge(
            prevPieces,
            selectedPieceId,
            neighborPieceId,
            edgeIndex,
            offset,
            parentRing
          );
          if (fallback) resultPieces = fallback;
        }
        if (!resultPieces) return prevPieces;
        if (wasClamped && Math.abs(appliedOffset - offset) > 0.001) {
          setEdgeSlideClampFeedback(`Limit: ${offset >= 0 ? "+" : ""}${offset.toFixed(2)}m → ${appliedOffset.toFixed(2)}m`);
        }
        const newSplitLines = deriveSplitLinesFromPieces(resultPieces);
        setSplitLines(newSplitLines);
        setHistoryStack((prev) => [...prev.slice(-9), { pieces: prevPieces, splitLines, fixedCuts, selectedPieceId }]);
        const newPieceA = resultPieces.find((p) => p.id === selectedPieceId);
        const newPieceB = resultPieces.find((p) => p.id === neighborPieceId);
        if (newPieceA && newPieceB) {
          const newEdgeIndex = findSharedEdgeIndexInPieceA(newPieceA, newPieceB);
          if (newEdgeIndex != null) setSelectedEdgeId(String(newEdgeIndex));
        }
        return resultPieces;
      });
    },
    [selectedPieceId, neighborPieceId, edgeSlideBaseSnapshot, parentRingForClip, splitLines, fixedCuts]
  );

  const handleEdgeSlideFinish = useCallback(() => {
    setSelectedEdgeId(null);
    setNeighborPieceId(null);
    setEdgeSlideBaseSnapshot(null);
    setEdgeSlideClampFeedback(null);
  }, []);

  const handleEdgeSlideCancel = useCallback(() => {
    if (edgeSlideBaseSnapshot) {
      setPieces(edgeSlideBaseSnapshot.pieces);
      setSplitLines(deriveSplitLinesFromPieces(edgeSlideBaseSnapshot.pieces));
    }
    setSelectedEdgeId(null);
    setNeighborPieceId(null);
    setEdgeSlideBaseSnapshot(null);
  }, [edgeSlideBaseSnapshot]);

  const rebuildFromRoad = useCallback(
    (newCenterline: Point[], newRoadPoly: Point[], newBaseParents: Point[][]) => {
      setRoadCenterline(newCenterline);
      setRoadPolygon(newRoadPoly);
      setBaseParentsRings(newBaseParents);
      const parentRings = newBaseParents?.length ? newBaseParents : ring ? [ring] : [];
      if (parentRings.length === 0) return;
      const N = Math.max(2, parseInt(targetCount, 10) || 2);
      const result = computeSplitMultiTotalCount({
        parentRings,
        targetCount: N,
        profile,
        orientation,
        selectedRoadEdges,
      });
      setPieces(result.pieces);
      setSplitLines(result.splitLines);
      setFixedCuts(result.cuts);
      if (__DEV__) {
        console.log("[ROAD_SLIDE][REBUILD]", {
          piecesCount: result.pieces.length,
          splitLinesCount: result.splitLines.length,
          totalArea: result.pieces.reduce((s, p) => s + p.area, 0),
        });
      }
    },
    [ring, targetCount, profile, orientation, selectedRoadEdges]
  );

  const handleRoadSelect = useCallback(
    (roadId: string | null, defaultSegmentIndex?: number) => {
      if (roadId == null) {
        setSelectedRoadId(null);
        setSelectedRoadHandle(null);
        selectedRoadIdRef.current = null;
        selectedRoadHandleRef.current = null;
        roadSlideReadySV.value = 0;
        setRoadSlideBaseSnapshot(null);
        return;
      }
      if (!roadCenterline || roadCenterline.length < 2) return;
      const segmentIndex =
        defaultSegmentIndex != null && defaultSegmentIndex >= 0 && defaultSegmentIndex < roadCenterline.length - 1
          ? defaultSegmentIndex
          : Math.floor((roadCenterline.length - 1) / 2);
      const handle = { type: "segment" as const, index: segmentIndex };
      setSelectedRoadId(roadId);
      setSelectedRoadHandle(handle);
      selectedRoadIdRef.current = roadId;
      selectedRoadHandleRef.current = handle;
      roadSlideReadySV.value = 1;
      setRoadSlideBaseSnapshot({
        roadCenterline: [...roadCenterline],
        roadPolygon: roadPolygon ? [...roadPolygon] : [],
        baseParentsRings: baseParentsRings ? baseParentsRings.map((r) => [...r]) : [],
        pieces: [...pieces],
        splitLines: [...splitLines],
      });
      setRoadSlideClampFeedback(null);
      if (__DEV__) console.log("[ROAD_SLIDE] selected road id=", roadId, "segment", segmentIndex);
    },
    [roadCenterline, roadPolygon, baseParentsRings, pieces, splitLines]
  );

  const handleRoadHandleSelect = useCallback(
    (handle: RoadHandleSelection) => {
      setSelectedRoadHandle(handle ?? null);
      selectedRoadHandleRef.current = handle ?? null;
      if (__DEV__ && handle) {
        console.log("[ROAD_SLIDE] handle", handle.type, "index=", handle.index);
      }
    },
    []
  );

  const handleRoadSlideBySegment = useCallback(
    (offsetMeters: number) => {
      if (!ring || !roadCenterline) return;
      const roadId = selectedRoadIdRef.current ?? selectedRoadId;
      if (!roadId) return;
      const h = selectedRoadHandleRef.current ?? selectedRoadHandle;
      const preferredIdx =
        h?.type === "segment"
          ? h.index
          : Math.floor((roadCenterline.length - 1) / 2);
      const nSeg = roadCenterline.length - 1;
      let res = translateRoadParallel(roadCenterline, preferredIdx, offsetMeters, ring ?? null);
      if (!res && nSeg > 1) {
        for (let i = 0; i < nSeg; i++) {
          if (i === preferredIdx) continue;
          res = translateRoadParallel(roadCenterline, i, offsetMeters, ring ?? null);
          if (res) {
            setSelectedRoadHandle({ type: "segment", index: i });
            selectedRoadHandleRef.current = { type: "segment", index: i };
            break;
          }
        }
      }
      if (!res) {
        setRoadSlideClampFeedback("Limit: 0m (yol sınırda)");
        return;
      }
      setRoadSlideClampFeedback(null);
      if (res.clamped && Math.abs(res.appliedOffsetMeters - offsetMeters) > 0.001) {
        setRoadSlideClampFeedback(
          `Limit: ${offsetMeters >= 0 ? "+" : ""}${offsetMeters.toFixed(2)}m → ${res.appliedOffsetMeters.toFixed(2)}m`
        );
      }
      let W = parseFloat(roadWidthInput);
      if (!Number.isFinite(W) || W <= 0) W = 2;
      W = Math.max(0.5, Math.min(30, W));
      const ext = extendPolylineToBoundary(res.newPoints, ring!, 1.5);
      const buf = buildRoadBufferPolygon(ext, W);
      const roadPoly = intersectRoadWithParent(buf, ring!);
      if (!roadPoly || roadPoly.length < 3) return;
      const baseParents = subtractRoadFromParent(ring!, roadPoly);
      if (baseParents.length === 0) return;
      rebuildFromRoad(ext, roadPoly, baseParents);
    },
    [roadCenterline, selectedRoadId, selectedRoadHandle, ring, roadWidthInput, rebuildFromRoad]
  );

  const handleRoadVertexMove = useCallback(
    (dx: number, dy: number) => {
      if (!ring || !roadCenterline || !selectedRoadId || selectedRoadHandle?.type !== "vertex") return;
      const idx = selectedRoadHandle.index;
      const newPoints = moveRoadVertex(roadCenterline, idx, dx, dy);
      if (!newPoints) return;
      setRoadSlideClampFeedback(null);
      let W = parseFloat(roadWidthInput);
      if (!Number.isFinite(W) || W <= 0) W = 2;
      W = Math.max(0.5, Math.min(30, W));
      const ext = extendPolylineToBoundary(newPoints, ring!, 1.5);
      const buf = buildRoadBufferPolygon(ext, W);
      const roadPoly = intersectRoadWithParent(buf, ring!);
      if (!roadPoly || roadPoly.length < 3) return;
      const baseParents = subtractRoadFromParent(ring!, roadPoly);
      if (baseParents.length === 0) return;
      rebuildFromRoad(ext, roadPoly, baseParents);
    },
    [roadCenterline, selectedRoadId, selectedRoadHandle, ring, roadWidthInput, rebuildFromRoad]
  );

  const handleRoadSlideFinish = useCallback(() => {
    setSelectedRoadId(null);
    setSelectedRoadHandle(null);
    selectedRoadIdRef.current = null;
    selectedRoadHandleRef.current = null;
    roadSlideReadySV.value = 0;
    setRoadSlideBaseSnapshot(null);
    setRoadSlideClampFeedback(null);
  }, [roadSlideReadySV]);

  const handleRoadSlideCancel = useCallback(() => {
    if (roadSlideBaseSnapshot) {
      setRoadCenterline(roadSlideBaseSnapshot.roadCenterline);
      setRoadPolygon(roadSlideBaseSnapshot.roadPolygon);
      setBaseParentsRings(roadSlideBaseSnapshot.baseParentsRings);
      setPieces(roadSlideBaseSnapshot.pieces);
      setSplitLines(roadSlideBaseSnapshot.splitLines);
    }
    setSelectedRoadId(null);
    setSelectedRoadHandle(null);
    selectedRoadIdRef.current = null;
    selectedRoadHandleRef.current = null;
    roadSlideReadySV.value = 0;
    setRoadSlideBaseSnapshot(null);
  }, [roadSlideBaseSnapshot, roadSlideReadySV]);

  const toggleRoadEdge = useCallback((edgeId: string) => {
    setSelectedRoadEdges((prev) => {
      const next = new Set(prev);
      if (next.has(edgeId)) next.delete(edgeId);
      else next.add(edgeId);
      return next;
    });
  }, []);

  const clearRoadEdges = useCallback(() => {
    setSelectedRoadEdges(new Set());
  }, []);

  const SNAP_TO_BOUNDARY_TOL = 4;
  const MERGE_POINTS_TOL = 2;

  const handleRoadDraftPoint = useCallback(
    (world: Point) => {
      setRoadDraftSelectedVertex(null);
      let pt = world;
      if (ring && ring.length >= 3) {
        const { point: snap, distSq } = closestPointOnRing(world, ring);
        if (distSq <= SNAP_TO_BOUNDARY_TOL * SNAP_TO_BOUNDARY_TOL) pt = snap;
      }
      setRoadDraftPoints((prev) => [...prev, pt]);
    },
    [ring]
  );

  const handleRoadDraftVertexSelect = useCallback((index: number | null) => {
    setRoadDraftSelectedVertex(index);
  }, []);

  const handleRoadDraftVertexMove = useCallback(
    (index: number, dx: number, dy: number) => {
      setRoadDraftSelectedVertex(null);
      setRoadDraftPoints((prev) => {
        if (index < 0 || index >= prev.length) return prev;
        let pt = { x: prev[index].x + dx, y: prev[index].y + dy };
        if (ring && ring.length >= 3) {
          const { point: snap, distSq } = closestPointOnRing(pt, ring);
          if (distSq <= SNAP_TO_BOUNDARY_TOL * SNAP_TO_BOUNDARY_TOL) pt = snap;
        }
        const mergeTolSq = MERGE_POINTS_TOL * MERGE_POINTS_TOL;
        for (let i = 0; i < prev.length; i++) {
          if (i === index) continue;
          const dx2 = pt.x - prev[i].x;
          const dy2 = pt.y - prev[i].y;
          if (dx2 * dx2 + dy2 * dy2 <= mergeTolSq) {
            const next = prev.filter((_, j) => j !== index);
            return next;
          }
        }
        const next = [...prev];
        next[index] = pt;
        return next;
      });
    },
    [ring]
  );

  const handleRemoveLastRoadPoint = useCallback(() => {
    setRoadDraftSelectedVertex(null);
    setRoadDraftPoints((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
  }, []);

  const handleCancelRoad = useCallback(() => {
    setRoadDraftPoints([]);
    setRoadDraftSelectedVertex(null);
    setRoadDrawSubMode("none");
  }, []);

  const applyCenterlineAsRoad = useCallback(
    (centerline: Point[], options?: { noExtend?: boolean }) => {
      if (!ring || centerline.length < 2) return;
      let W = parseFloat(roadWidthInput);
      if (!Number.isFinite(W) || W <= 0) W = 2;
      W = Math.max(0.5, Math.min(30, W));
      const ext = options?.noExtend ? centerline : extendPolylineToBoundary(centerline, ring, 1.5);
      const buf = buildRoadBufferPolygon(ext, W);
      const roadPoly = intersectRoadWithParent(buf, ring);
      if (!roadPoly || roadPoly.length < 3) return;
      const baseParents = subtractRoadFromParent(ring, roadPoly);
      if (baseParents.length === 0) return;
      rebuildFromRoad(ext, roadPoly, baseParents);
      setRoadPolygon(roadPoly);
      setRoadCenterline(ext);
      setBaseParentsRings(baseParents);
      setSelectedPieceId(null);
      setRoadSelected(true);
      setUiMode("pan_zoom");
      // Parsel çizimi varken yol çizilirse otomatik parsel çiz; yokken çizme (hatalı sonuç veriyor).
      if (pieces.length > 0 || splitLines.length > 0) {
        const N = Math.max(2, parseInt(targetCount, 10) || 2);
        const result = computeSplitMultiTotalCount({
          parentRings: baseParents,
          targetCount: N,
          profile,
          orientation,
          selectedRoadEdges,
        });
        setPieces(result.pieces);
        setSplitLines(result.splitLines);
        setFixedCuts(result.cuts);
      }
    },
    [ring, roadWidthInput, rebuildFromRoad, targetCount, profile, orientation, selectedRoadEdges, pieces.length, splitLines.length]
  );

  const handleRoadDrawSubModeSelect = useCallback(
    (mode: RoadDrawSubMode) => {
      setRoadDrawSubMode(mode);
      if (mode === "vertical" && ring && ring.length >= 3) {
        const centerline = createVerticalCenterline(ring);
        applyCenterlineAsRoad(centerline);
      } else if (mode === "horizontal" && ring && ring.length >= 3) {
        const centerline = createHorizontalCenterline(ring);
        applyCenterlineAsRoad(centerline);
      } else if (mode === "edge") {
        setSelectedParentEdgeForRoad(null);
      } else if (mode === "freehand") {
        setSelectedParentEdgeForRoad(null);
      }
    },
    [ring, applyCenterlineAsRoad]
  );

  const handleParentEdgeSelectForRoad = useCallback(
    (edgeIndex: number | null) => {
      if (edgeIndex == null) {
        setSelectedParentEdgeForRoad(null);
        setEdgeRoadDraft(null);
        setEdgeRoadActiveEnd(null);
        return;
      }
      setSelectedParentEdgeForRoad(edgeIndex);
      if (!ring || ring.length < 3) return;
      let W = parseFloat(roadWidthInput);
      if (!Number.isFinite(W) || W <= 0) W = 2;
      W = Math.max(0.5, Math.min(30, W));
      const offsetMeters = W / 2;
      const baseLine = createEdgeParallelBaseLine(ring, edgeIndex, offsetMeters);
      if (!baseLine) return;
      const [p1, p2] = baseLine;
      setEdgeRoadDraft({
        edgeIndex,
        baseLine,
        trim0: 0,
        trim1: 1,
        currentLine: [p1, p2],
      });
      setEdgeRoadActiveEnd(null);
    },
    [ring, roadWidthInput]
  );

  const handleSelectEdgeRoadEnd = useCallback((endIndex: 0 | 1) => {
    setEdgeRoadActiveEnd(endIndex);
  }, []);

  const handleEdgeRoadSlide = useCallback(
    (deltaMeters: number) => {
      if (!edgeRoadDraft || edgeRoadActiveEnd == null) return;
      const [p1, p2] = edgeRoadDraft.baseLine;
      const baseLen = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
      const minGap = Math.max(0.02, 2 / baseLen);
      const dt = Math.max(-0.25, Math.min(0.25, deltaMeters / baseLen));
      let trim0 = edgeRoadDraft.trim0;
      let trim1 = edgeRoadDraft.trim1;
      if (edgeRoadActiveEnd === 0) {
        trim0 = Math.max(0, Math.min(trim0 + dt, trim1 - minGap));
      } else {
        trim1 = Math.min(1, Math.max(trim1 + dt, trim0 + minGap));
      }
      const newP1 = { x: p1.x + trim0 * (p2.x - p1.x), y: p1.y + trim0 * (p2.y - p1.y) };
      const newP2 = { x: p1.x + trim1 * (p2.x - p1.x), y: p1.y + trim1 * (p2.y - p1.y) };
      setEdgeRoadDraft({
        ...edgeRoadDraft,
        trim0,
        trim1,
        currentLine: [newP1, newP2],
      });
    },
    [edgeRoadDraft, edgeRoadActiveEnd]
  );

  const handleCompleteEdgeRoad = useCallback(() => {
    if (!edgeRoadDraft || !ring || ring.length < 3) return;
    const MERGE_TOL = 1.5;
    let centerline: Point[] = [...edgeRoadDraft.currentLine];
    if (roadMergePreview && roadMergePreview.distance < MERGE_TOL && roadCenterline && roadCenterline.length >= 2) {
      const merged = mergeRoads(centerline, roadCenterline, roadMergePreview, ring);
      if (merged.length >= 2) centerline = merged;
    } else if (roadCenterline && roadCenterline.length >= 2) {
      centerline = appendRoadsByClosestEndpoints(roadCenterline, centerline);
    }
    if (centerline.length >= 2) {
      const noExtend = centerline.length === 2;
      applyCenterlineAsRoad(centerline, { noExtend });
      setEdgeRoadDraft(null);
      setEdgeRoadActiveEnd(null);
      setSelectedParentEdgeForRoad(null);
      setRoadDrawSubMode("none");
      setRoadMergePreview(null);
    }
  }, [edgeRoadDraft, ring, roadMergePreview, roadCenterline, applyCenterlineAsRoad]);

  const handleCancelEdgeRoad = useCallback(() => {
    setEdgeRoadDraft(null);
    setEdgeRoadActiveEnd(null);
    setSelectedParentEdgeForRoad(null);
    setRoadDrawSubMode("none");
    setRoadMergePreview(null);
  }, []);

  const handleActionBarKenarOlculeri = useCallback(() => {
    setShowEdgeMeasurements((v) => !v);
    if (uiMode === "draw_road") setRoadDraftPoints([]);
    if (uiMode === "edge_slide") setUiMode("select_piece");
    if (uiMode === "road_slide") setUiMode("pan_zoom");
  }, [uiMode]);

  const handleActionBarYolCiz = useCallback(() => {
    if (uiMode === "draw_road") {
      setUiMode("pan_zoom");
    } else {
      if (uiMode === "edge_slide") setUiMode("select_piece");
      setUiMode("draw_road");
    }
  }, [uiMode]);

  const handleActionBarKenarKaydir = useCallback(() => {
    if (uiMode === "edge_slide") {
      setUiMode("select_piece");
    } else {
      if (uiMode === "draw_road") setRoadDraftPoints([]);
      if (uiMode === "road_slide") handleRoadSlideCancel();
      setUiMode("edge_slide");
    }
  }, [uiMode, handleRoadSlideCancel]);

  const handleActionBarYolKaydir = useCallback(() => {
    if (uiMode === "road_slide") {
      setUiMode("pan_zoom");
    } else {
      if (uiMode === "draw_road") setRoadDraftPoints([]);
      if (uiMode === "edge_slide") setUiMode("select_piece");
      setUiMode("road_slide");
    }
  }, [uiMode]);

  const handleCompleteRoad = useCallback(() => {
    if (!ring || ring.length < 3 || roadDraftPoints.length < 2) return;
    let W = parseFloat(roadWidthInput);
    if (!Number.isFinite(W) || W <= 0) W = 2;
    W = Math.max(0.5, Math.min(30, W));

    const preview = roadMergePreview ?? computeMergeCandidate(roadDraftPoints, roadCenterline ?? null, ring, 1.5);
    let mergedCenterline: Point[];

    if (preview?.active && preview.targetType === "road" && roadCenterline && roadCenterline.length >= 2) {
      mergedCenterline = mergeRoads(roadDraftPoints, roadCenterline, preview, ring);
    } else if (preview?.active && preview.targetType === "boundary") {
      const snapped = [...roadDraftPoints];
      if (preview.draftEndpointIndex === 0) snapped[0] = preview.targetPoint;
      else snapped[snapped.length - 1] = preview.targetPoint;
      mergedCenterline = roadCenterline && roadCenterline.length >= 2
        ? appendRoadsByClosestEndpoints(roadCenterline, snapped)
        : snapped;
    } else if (roadCenterline && roadCenterline.length >= 2) {
      mergedCenterline = appendRoadsByClosestEndpoints(roadCenterline, roadDraftPoints);
    } else {
      mergedCenterline = extendPolylineToBoundary(roadDraftPoints, ring, 1.5);
    }

    const clippedCenterline = clipPolylineToRing(mergedCenterline, ring);
    const extendedPoints = extendPolylineToBoundary(clippedCenterline, ring, 1.5);
    const roadBufferRing = buildRoadBufferPolygon(extendedPoints, W);
    const roadPoly = intersectRoadWithParent(roadBufferRing, ring);
    if (!roadPoly || roadPoly.length < 3) {
      Alert.alert("Uyarı", "Yol parsel içinde oluşmadı.");
      return;
    }

    const baseParents = subtractRoadFromParent(ring, roadPoly);
    if (baseParents.length === 0) {
      Alert.alert("Uyarı", "Yol parsel içinde oluşmadı.");
      return;
    }

    if (__DEV__) {
      const roadArea = polygonArea(roadPoly);
      console.log("[ParcelSplit] Tamamla yol:", {
        W,
        merged: !!preview?.active,
        roadPolygonArea: roadArea,
        baseParentsCount: baseParents.length,
      });
    }

    setRoadPolygon(roadPoly);
    setRoadCenterline(extendedPoints);
    setBaseParentsRings(baseParents);
    setRoadDraftPoints([]);
    setRoadMergePreview(null);
    setSelectedPieceId(null);
    setRoadSelected(true);
    setUiMode("pan_zoom");

    const N = Math.max(2, parseInt(targetCount, 10) || 2);
    const result = computeSplitMultiTotalCount({
      parentRings: baseParents,
      targetCount: N,
      profile,
      orientation,
      selectedRoadEdges,
    });
    setPieces(result.pieces);
    setSplitLines(result.splitLines);
    setFixedCuts(result.cuts);
  }, [ring, roadDraftPoints, roadWidthInput, roadMergePreview, roadCenterline, targetCount, profile, orientation, selectedRoadEdges]);

  const handleDeleteRoad = useCallback(() => {
    setRoadPolygon(null);
    setRoadCenterline(null);
    setBaseParentsRings(null);
    setPieces([]);
    setSplitLines([]);
    setFixedCuts([]);
    setSelectedPieceId(null);
    setDetailModalPiece(null);
    setRoadSelected(false);
  }, []);

  const parentPolygonGeoJSON = useMemo(() => {
    if (parentPolygonRaw == null) return null;
    let raw: unknown = parentPolygonRaw;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        return null;
      }
    }
    const g = raw as { type?: string; coordinates?: unknown[] };
    if (g?.type === "Polygon" && Array.isArray(g.coordinates) && g.coordinates[0]) {
      return raw as { type: "Polygon"; coordinates: number[][][] };
    }
    return null;
  }, [parentPolygonRaw]);

  useEffect(() => {
    if (!showEdgeMeasurements || !parentPolygonGeoJSON || !originMeters) {
      if (!showEdgeMeasurements) setParentEdgeMeasurementsMetre(null);
      return;
    }
    let cancelled = false;
    let djangoUrl = API_URL;
    if (djangoUrl.includes(":8001")) djangoUrl = djangoUrl.replace(":8001", ":8000");
    djangoUrl = djangoUrl.replace("/api", "").replace(/\/$/, "");

    const coordinates = parentPolygonGeoJSON.coordinates[0];
    const requestBody = { coordinates, mahalle: "", ada: "", parsel: "" };

    fetch(`${djangoUrl}/api/calculate_edge_measures/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Kenar ölçüleri hesaplanamadı");
        return res.json();
      })
      .then((data: { success?: boolean; edge_measure_data?: EdgeMeasureData }) => {
        if (cancelled || !data.success || !data.edge_measure_data) return;
        const features = createEdgeMeasurementFeatures(parentPolygonGeoJSON, data.edge_measure_data);
        const metreFeatures = edgeFeaturesToMetre(features, originMeters, ring ?? null);
        setParentEdgeMeasurementsMetre(metreFeatures);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[ParcelSplit] edge measures fetch:", err);
          Alert.alert("Hata", "Kenar ölçüleri alınamadı. Backend (8000) çalışıyor mu?");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showEdgeMeasurements, parentPolygonGeoJSON, originMeters, ring]);

  /** Kenar ölçüleri: etiketler parsel dışında (outward offset) — hem Canvas2D hem PDF aynı pipeline. */
  const edgeMeasurementsMetre = useMemo(() => {
    const raw = parentEdgeMeasurementsMetre ?? [];
    if (ring && ring.length >= 2 && raw.length > 0) return moveSegmentLabelsOutside(ring, raw);
    return raw;
  }, [ring, parentEdgeMeasurementsMetre]);

  const handleCompute = useCallback(() => {
    const parentRings = baseParentsRings?.length ? baseParentsRings : ring ? [ring] : [];
    if (!parentRings.length) return;
    const N = Math.max(2, parseInt(targetCount, 10) || 2);
    const result = computeSplitMultiTotalCount({
      parentRings,
      targetCount: N,
      profile,
      orientation,
      selectedRoadEdges,
    });
    if (__DEV__) {
      console.log("[ParcelSplit] handleCompute:", {
        parentRingsCount: parentRings.length,
        targetCount: N,
        piecesCount: result.pieces.length,
      });
    }
    setPieces(result.pieces);
    setSplitLines(result.splitLines);
    setFixedCuts(result.cuts);
    setSelectedPieceId(null);
    setDetailModalPiece(null);
    setUiMode("select_piece");
  }, [
    ring,
    baseParentsRings,
    targetCount,
    profile,
    orientation,
    selectedRoadEdges,
  ]);

  const isRecomputing = false;
  const pdfBusyOnlyDisabled = pdfBusy;

  const buildPdf = useCallback(async (): Promise<{ pdfUri: string; filename: string }> => {
    const piecesNow = piecesRef.current ?? pieces;
    if (!pdfParentRenderRef.current) throw new Error("PDF render alanı hazır değil");
    const screenshot = await pdfParentRenderRef.current.capture({
      format: "png",
      quality: 0.9,
      result: "base64",
      width: PDF_PARENT_W,
      height: PDF_PARENT_H,
    });
    const screenshotBase64 = screenshot.startsWith("data:") ? screenshot.replace(/^data:image\/\w+;base64,/, "") : screenshot;

    await new Promise((r) => setTimeout(r, 600));
    const refs = pieceShotRefs.current;
    const count = piecesNow.length;
    for (let w = 0; w < 25; w++) {
      let ready = true;
      for (let j = 0; j < count; j++) {
        if (!refs[j] || typeof refs[j].capture !== "function") {
          ready = false;
          break;
        }
      }
      if (ready) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    const pieceImages: string[] = [];
    for (let i = 0; i < count; i++) {
      try {
        const shotRef = refs[i];
        if (shotRef && typeof shotRef.capture === "function") {
          const b64 = await shotRef.capture({
            format: "png",
            quality: 0.9,
            result: "base64",
            width: PDF_THUMB_W,
            height: PDF_THUMB_H,
          });
          const raw = b64.startsWith("data:") ? b64.replace(/^data:image\/\w+;base64,/, "") : b64;
          pieceImages.push(raw);
        } else {
          pieceImages.push("");
        }
        await new Promise((r) => setTimeout(r, 100));
      } catch {
        pieceImages.push("");
      }
    }

    const piecesData = piecesNow.map((p, idx) => ({
      id: p.id ?? `P-${idx + 1}`,
      pieceNumber: idx + 1,
      area: Math.round(p.area * 100) / 100,
      edgeLengths: computeEdgeLengths(p.polygon.ring),
      valid: p.valid,
      violations: p.violations,
      imageBase64: pieceImages[idx] ?? "",
      ring: p.polygon.ring ?? [],
    }));
    if (__DEV__) {
      console.log("[PDF] parentImg?", !!screenshotBase64, "piecesData", piecesData.length, "firstThumbLen", piecesData[0]?.imageBase64?.length ?? 0);
    }
    const fileName = parcelSplitFileName(params.mahalle, params.ada, params.parsel);
    const { pdfUri, filename } = await generateParcelSplitPdf({
      title: "Hisseli Parsel Bölme Raporu",
      dateStr: new Date().toLocaleString("tr-TR"),
      screenshotBase64,
      pieces: piecesData,
      fileName,
    });
    return { pdfUri, filename };
  }, [pieces, params.mahalle, params.ada, params.parsel]);

  /** Sadece kaydet (PDF oluştur + listeye ekle). Aynı parsel varsa öncekinin üzerine yazar. */
  const doSave = useCallback(async () => {
    if (pieces.length === 0) {
      Alert.alert("Bilgi", "PDF için önce parsel bölmesi yapın (Hesapla).");
      return;
    }
    if (pdfBusyOnlyDisabled) return;
    const prevEdgeMeasurements = showEdgeMeasurements;
    setShowEdgeMeasurements(true);
    setPdfBusy(true);
    await new Promise((r) => setTimeout(r, 500));
    try {
      const { pdfUri, filename } = await buildPdf();
      await addSavedParcelSplitProject({
        fileName: filename,
        filePath: pdfUri,
        mahalle: params.mahalle,
        ada: params.ada,
        parsel: params.parsel,
      });
      Alert.alert("Kaydedildi", `PDF: ${filename}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "PDF oluşturulamadı";
      Alert.alert("Hata", msg);
    } finally {
      setPdfBusy(false);
      setShowEdgeMeasurements(prevEdgeMeasurements);
    }
  }, [pieces.length, pdfBusyOnlyDisabled, showEdgeMeasurements, buildPdf, params.mahalle, params.ada, params.parsel]);

  /** Paylaş + kaydet (paylaşım sonrası kullanıcı tarafında da kaydedilir). */
  const doShare = useCallback(async () => {
    if (pieces.length === 0) {
      Alert.alert("Bilgi", "PDF için önce parsel bölmesi yapın (Hesapla).");
      return;
    }
    if (pdfBusyOnlyDisabled) return;
    const prevEdgeMeasurements = showEdgeMeasurements;
    setShowEdgeMeasurements(true);
    setPdfBusy(true);
    await new Promise((r) => setTimeout(r, 500));
    try {
      const { pdfUri, filename } = await buildPdf();
      const fileUrl = pdfUri.startsWith("file://") ? pdfUri : `file://${pdfUri}`;
      await Share.open({
        url: fileUrl,
        type: "application/pdf",
        title: "PDF Paylaş",
      });
      await addSavedParcelSplitProject({
        fileName: filename,
        filePath: pdfUri,
        mahalle: params.mahalle,
        ada: params.ada,
        parsel: params.parsel,
      });
      Alert.alert("Paylaşıldı", "PDF paylaşıldı ve kaydedildi.");
    } catch (e: unknown) {
      if (e && typeof e === "object" && "message" in e && (e as { message: string }).message === "User did not share") {
        return;
      }
      const msg = e instanceof Error ? e.message : "PDF paylaşılamadı";
      Alert.alert("Hata", msg);
    } finally {
      setPdfBusy(false);
      setShowEdgeMeasurements(prevEdgeMeasurements);
    }
  }, [pieces.length, pdfBusyOnlyDisabled, showEdgeMeasurements, buildPdf, params.mahalle, params.ada, params.parsel]);

  const onSavePress = useCallback(async () => {
    if (!hasPurchasedView) {
      setPendingAction("save");
      setPurchaseModalVisible(true);
      return;
    }
    await doSave();
  }, [hasPurchasedView, doSave]);

  const onSharePress = useCallback(async () => {
    if (!hasPurchasedView) {
      setPendingAction("share");
      setPurchaseModalVisible(true);
      return;
    }
    await doShare();
  }, [hasPurchasedView, doShare]);

  const doSaveAndBack = useCallback(async () => {
    setPdfBusy(true);
    try {
      const { pdfUri, filename } = await buildPdf();
      await addSavedParcelSplitProject({
        fileName: filename,
        filePath: pdfUri,
        mahalle: params.mahalle,
        ada: params.ada,
        parsel: params.parsel,
      });
      setPdfBusy(false);
      Alert.alert("Kaydedildi", `PDF: ${filename}`, [
        { text: "Tamam", onPress: () => router.back() },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "PDF oluşturulamadı";
      Alert.alert("Hata", msg);
      setPdfBusy(false);
    }
  }, [buildPdf, router, params.mahalle, params.ada, params.parsel]);

  const handleBackRequest = useCallback(() => {
    // Satın alma yapıldıysa geri tuşunda hiçbir şey sorma, doğrudan çık
    if (hasPurchasedView) {
      router.back();
      return;
    }
    Alert.alert(
      "Projeyi Kaydet",
      "Projeyi kaydetmek istiyor musunuz?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Hayır",
          style: "destructive",
          onPress: () => router.back(),
        },
        {
          text: "Evet",
          onPress: () => {
            setPendingAction("saveAndBack");
            setPurchaseModalVisible(true);
          },
        },
      ]
    );
  }, [router, hasPurchasedView]);

  const onPurchaseSuccessFromModal = useCallback(async () => {
    await setParcelSplitPurchased(params.mahalle, params.ada, params.parsel);
    setHasPurchasedView(true);
    const action = pendingAction;
    setPendingAction(null);
    if (action === "saveAndBack") {
      doSaveAndBack();
    } else if (action === "save") {
      doSave();
    } else if (action === "share") {
      doShare();
    }
  }, [pendingAction, params.mahalle, params.ada, params.parsel, doSaveAndBack, doSave, doShare]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBackRequest();
      return true;
    });
    return () => sub.remove();
  }, [handleBackRequest]);

  const computeDisabled = !ring || ring.length < 3;
  const hasRing = !!(ring && ring.length >= 3);
  const totalArea = ring && ring.length >= 3 ? polygonArea(ring) : 0;
  const targetLabel =
    mode === "by_count"
      ? `${targetCount || "0"} adet`
      : `${targetArea || "0"} m²`;
  const invalidCount = pieces.filter((p) => !p.valid).length;

  const pieceA = selectedPieceId ? pieces.find((p) => p.id === selectedPieceId) : null;
  const pieceB = neighborPieceId ? pieces.find((p) => p.id === neighborPieceId) : null;
  const edgeSlideAreaA = pieceA?.area ?? 0;
  const edgeSlideAreaB = pieceB?.area ?? 0;
  const edgeSlideDeltaA = edgeSlideBaseSnapshot ? edgeSlideAreaA - edgeSlideBaseSnapshot.baseAreaA : 0;
  const edgeSlideDeltaB = edgeSlideBaseSnapshot ? edgeSlideAreaB - edgeSlideBaseSnapshot.baseAreaB : 0;
  const hasEdgeSlideSelection = !!(selectedPieceId && selectedEdgeId && neighborPieceId);

  const onCanvasLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCanvasLayout({ width, height });
    }
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top, height: 54 + insets.top }]}>
        <TouchableOpacity
          onPress={handleBackRequest}
          style={styles.headerBtn}
          accessibilityLabel="Geri"
        >
          <Ionicons name="arrow-back" size={18} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Hisseli Parsel Bölme
        </Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={onSavePress}
            style={[styles.headerBtn, pdfBusyOnlyDisabled && styles.headerBtnDisabled]}
            disabled={pdfBusyOnlyDisabled}
            accessibilityLabel="PDF Kaydet"
            activeOpacity={pdfBusyOnlyDisabled ? 1 : 0.7}
          >
            <Ionicons name="save-outline" size={20} color="#f8fafc" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onSharePress}
            style={[styles.headerBtn, pdfBusyOnlyDisabled && styles.headerBtnDisabled]}
            disabled={pdfBusyOnlyDisabled}
            accessibilityLabel="PDF Paylaş"
            activeOpacity={pdfBusyOnlyDisabled ? 1 : 0.7}
          >
            <Ionicons name="share-outline" size={20} color="#f8fafc" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setHelpVisible(true)}
            style={styles.headerBtn}
            accessibilityLabel="Yardım"
          >
            <Ionicons name="information-circle-outline" size={20} color="#f8fafc" />
          </TouchableOpacity>
        </View>
      </View>

      {hasRing && roadPolygon && roadPolygon.length >= 3 && roadSelected && (
        <View style={styles.roadDeleteBar}>
          <Text style={styles.roadDeleteLabel}>Yol seçili</Text>
          <TouchableOpacity style={styles.roadDeleteBtn} onPress={handleDeleteRoad} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={18} color="#fff" />
            <Text style={styles.roadDeleteText}>Yolu sil</Text>
          </TouchableOpacity>
        </View>
      )}

      {hasRing && (
        <ActionBar
          uiMode={uiMode}
          setUiMode={setUiMode}
          showEdgeMeasurements={showEdgeMeasurements}
          setShowEdgeMeasurements={setShowEdgeMeasurements}
          hasPieces={pieces.length > 0}
          hasRoad={!!(roadPolygon && roadCenterline && roadCenterline.length >= 2)}
          onDrawRoadToggle={() => setRoadDraftPoints([])}
          onKenarOlculeriPress={handleActionBarKenarOlculeri}
          onYolCizPress={handleActionBarYolCiz}
          onKenarKaydirPress={handleActionBarKenarKaydir}
          onYolKaydirPress={handleActionBarYolKaydir}
          onAyarlarPress={() => setSettingsSheetVisible(true)}
          onParsellerPress={() => setPieceListVisible(true)}
        />
      )}

      {uiMode === "draw_road" && hasRing && (
        <RoadQuickPanel
          roadDrawSubMode={roadDrawSubMode}
          onSelectSubMode={handleRoadDrawSubModeSelect}
        />
      )}
      {uiMode === "draw_road" && roadDrawSubMode === "freehand" && hasRing && (
        <RoadModeBar
          roadWidthInput={roadWidthInput}
          setRoadWidthInput={setRoadWidthInput}
          roadDraftPointsCount={roadDraftPoints.length}
          onComplete={handleCompleteRoad}
          onRemoveLast={handleRemoveLastRoadPoint}
          onCancel={handleCancelRoad}
        />
      )}
      {uiMode === "draw_road" && edgeRoadDraft && (
        <EdgeRoadModeBar
          onComplete={handleCompleteEdgeRoad}
          onCancel={handleCancelEdgeRoad}
        />
      )}

      {uiMode === "edge_slide" && hasRing && (
        <EdgeSlideModeBar
          edgeSlideStep={edgeSlideStep}
          onEdgeSlideStepChange={setEdgeSlideStep}
          selectedEdgeId={selectedEdgeId}
          onArrow={handleEdgeSlideBy}
          hasEdgeSlideSelection={hasEdgeSlideSelection}
          onFinish={handleEdgeSlideFinish}
          onCancel={handleEdgeSlideCancel}
        />
      )}

      {uiMode === "road_slide" && hasRing && (
        <RoadSlideModeBar
          roadSlideStep={roadSlideStep}
          onRoadSlideStepChange={setRoadSlideStep}
          selectedHandle={selectedRoadHandle}
          onSegmentArrow={handleRoadSlideBySegment}
          onVertexMove={handleRoadVertexMove}
          hasRoadSlideSelection={!!(selectedRoadId && roadCenterline)}
          onFinish={handleRoadSlideFinish}
          onCancel={handleRoadSlideCancel}
        />
      )}

      {pdfBusy && (
        <View style={styles.pdfOverlay}>
          <Text style={styles.pdfOverlayText}>PDF hazırlanıyor…</Text>
        </View>
      )}

      {hasRing && pieces.length > 0 && (
        <View
          style={[
            styles.pdfPieceThumbnailsHidden,
            { width: Math.max(VIEW_WIDTH, pieces.length * (PDF_THUMB_W + 4)) },
          ]}
          pointerEvents="none"
        >
          <ViewShot
            ref={(r) => {
              pdfParentRenderRef.current = r as unknown as { capture: (opts?: object) => Promise<string> };
            }}
            options={{ format: "png", quality: 0.9, result: "base64" }}
            style={{ width: PDF_PARENT_W, height: PDF_PARENT_H }}
            collapsable={false}
          >
            <PdfRenderCanvas
              mode="parent"
              parentRing={ring!}
              pieces={pieces}
              splitLines={splitLines}
              roadPolygon={roadPolygon}
              edgeMeasurementsMetre={edgeMeasurementsMetre}
              widthPx={PDF_PARENT_W}
              heightPx={PDF_PARENT_H}
            />
          </ViewShot>
          {pieces.map((piece, i) => (
            <ViewShot
              key={`pdf-thumb-${i}-${piece.id}`}
              ref={((idx: number) => (r: any) => {
                const refs = pieceShotRefs.current;
                refs[idx] = r != null ? (r as unknown as { capture: (opts?: object) => Promise<string> }) : null;
              })(i)}
              options={{ format: "png", quality: 0.9, result: "base64" }}
              style={{ width: PDF_THUMB_W, height: PDF_THUMB_H }}
              collapsable={false}
            >
              <PdfRenderCanvas
                mode="piece"
                parentRing={ring!}
                pieces={pieces}
                splitLines={[]}
                roadPolygon={null}
                edgeMeasurementsMetre={[]}
                pieceIndex={i}
                widthPx={PDF_THUMB_W}
                heightPx={PDF_THUMB_H}
              />
            </ViewShot>
          ))}
        </View>
      )}

      <View style={styles.canvasWrap} onLayout={onCanvasLayout}>
        {!hasRing ? (
          <View style={styles.center}>
            <Text style={styles.muted}>Parsel geometrisi yok.</Text>
          </View>
        ) : canvasLayout.height > 0 ? (
          <>
            <ViewShot
              ref={captureTargetRef}
              options={{ format: "png", quality: 1, result: "base64" }}
              style={{ width: canvasLayout.width, height: canvasLayout.height }}
            >
              <Canvas2D
              ref={canvasRef}
              ring={ring}
              width={canvasLayout.width}
              height={canvasLayout.height}
              uiMode={uiMode}
              roadDrawSubMode={roadDrawSubMode}
              edges={edges}
              selectedRoadEdges={selectedRoadEdges}
              onToggleRoadEdge={toggleRoadEdge}
              pieces={pieces}
              splitLines={splitLines}
              selectedPieceId={selectedPieceId}
              onPieceSelect={handleSelectPiece}
              showEdgeMeasurements={showEdgeMeasurements}
              edgeMeasurementsMetre={edgeMeasurementsMetre.length > 0 ? edgeMeasurementsMetre : undefined}
              selectedEdgeId={selectedEdgeId}
              onSelectEdge={handleSelectEdge}
              onEdgeSlideDrag={(deltaM) => handleEdgeSlideBy(deltaM)}
              roadDraftPoints={roadDrawSubMode === "freehand" ? roadDraftPoints : []}
              roadMergePreview={roadMergePreview}
              onMergePreviewChange={setRoadMergePreview}
              edgeRoadDraft={edgeRoadDraft}
              edgeRoadActiveEnd={edgeRoadActiveEnd}
              onSelectEdgeRoadEnd={handleSelectEdgeRoadEnd}
              onEdgeRoadSlide={handleEdgeRoadSlide}
              onCompleteEdgeRoad={handleCompleteEdgeRoad}
              roadDraftSelectedVertex={roadDraftSelectedVertex}
              roadPolygon={roadPolygon}
              onRoadDraftPoint={handleRoadDraftPoint}
              onRoadDraftVertexSelect={handleRoadDraftVertexSelect}
              onRoadDraftVertexMove={handleRoadDraftVertexMove}
              roadSelected={roadSelected}
              onRoadSelect={setRoadSelected}
              roadCenterline={roadCenterline}
              selectedRoadId={selectedRoadId}
              selectedRoadHandle={selectedRoadHandle}
              selectedRoadHandleRef={selectedRoadHandleRef}
              roadSlideReadySV={roadSlideReadySV}
              onRoadSelectId={handleRoadSelect}
              onRoadHandleSelect={handleRoadHandleSelect}
              onRoadSlideDragSegment={handleRoadSlideBySegment}
              onRoadSlideDragVertex={handleRoadVertexMove}
              selectedParentEdgeForRoad={selectedParentEdgeForRoad}
              onSelectParentEdgeForRoad={handleParentEdgeSelectForRoad}
              />
            </ViewShot>
            {uiMode === "draw_road" && roadDrawSubMode === "edge" && !edgeRoadDraft && (
              <View style={styles.edgeSlideChipsWrap} pointerEvents="box-none">
                <Text style={styles.roadSlideHint}>Kenar seç: Parsel sınırındaki bir kenara dokunun</Text>
              </View>
            )}
            {uiMode === "draw_road" && edgeRoadDraft && (
              <View style={styles.edgeSlideChipsWrap} pointerEvents="box-none">
                <Text style={styles.roadSlideHint}>Yol uzunluğu: Çizgiyi yukarı/aşağı kaydırın</Text>
              </View>
            )}
            {uiMode === "draw_road" && roadDrawSubMode === "freehand" && (
              <StatsChip
                mode="draw_road"
                roadWidth={roadWidthInput}
                pointCount={roadDraftPoints.length}
                visible
              />
            )}
            {uiMode === "edge_slide" && hasEdgeSlideSelection && (
              <StatsChip
                mode="edge_slide"
                areaA={edgeSlideAreaA}
                areaB={edgeSlideAreaB}
                deltaA={edgeSlideDeltaA}
                deltaB={edgeSlideDeltaB}
                visible
              />
            )}
            {uiMode === "road_slide" && selectedRoadId && (
              <View style={styles.edgeSlideChipsWrap} pointerEvents="box-none">
                <Text style={styles.roadSlideHint}>Yolu seçin; kaydırmak için okları kullanın veya segment/vertex tutamacına dokunun</Text>
                {roadSlideClampFeedback && (
                  <Text style={styles.edgeSlideClampFeedback}>{roadSlideClampFeedback}</Text>
                )}
              </View>
            )}
            {uiMode === "edge_slide" && hasEdgeSlideSelection && (
              <View style={styles.edgeSlideChipsWrap} pointerEvents="box-none">
                <View style={styles.edgeSlideChips}>
                <View style={styles.edgeSlideChip}>
                  <Text style={styles.edgeSlideChipLabel}>Seçili parsel</Text>
                  <Text style={styles.edgeSlideChipValue}>
                    {Math.round(edgeSlideAreaA)} m² {edgeSlideDeltaA >= 0 ? "+" : ""}{Math.round(edgeSlideDeltaA)}
                  </Text>
                </View>
                <View style={styles.edgeSlideChip}>
                  <Text style={styles.edgeSlideChipLabel}>Komşu parsel</Text>
                  <Text style={styles.edgeSlideChipValue}>
                    {Math.round(edgeSlideAreaB)} m² {edgeSlideDeltaB >= 0 ? "+" : ""}{Math.round(edgeSlideDeltaB)}
                  </Text>
                </View>
                </View>
                {edgeSlideClampFeedback && (
                  <Text style={styles.edgeSlideClampFeedback}>{edgeSlideClampFeedback}</Text>
                )}
              </View>
            )}
            <FloatingTools
              onZoomIn={() => canvasRef.current?.zoomIn()}
              onZoomOut={() => canvasRef.current?.zoomOut()}
              onFitToView={() => canvasRef.current?.fitToView()}
              visible
            />
          </>
        ) : null}
      </View>

      <HelpBottomSheet
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        insetsBottom={insets.bottom}
      />

      <ParcelSplitPurchaseModal
        visible={purchaseModalVisible}
        onClose={() => {
          setPurchaseModalVisible(false);
          setPendingAction(null);
        }}
        referenceId={params.parcelId}
        onPurchaseSuccess={onPurchaseSuccessFromModal}
      />

      <PieceListBottomSheet
        visible={pieceListVisible}
        onClose={() => setPieceListVisible(false)}
        pieces={pieces}
        selectedPieceId={selectedPieceId}
        onSelectPiece={(id: string | null) => {
          handleSelectPiece(id);
          if (id) setPieceListVisible(false);
        }}
        insetsBottom={insets.bottom}
      />

      <MergeNeighborBottomSheet
        visible={mergeNeighborVisible}
        onClose={() => {
          setMergeNeighborVisible(false);
          setDeletedPiece(null);
        }}
        deletedPiece={deletedPiece}
        adjacentPieces={adjacentPiecesForMerge}
        onSelectNeighbor={handleMergeWithNeighbor}
        insetsBottom={insets.bottom}
      />

      {detailModalPiece ? (
        <PieceDetailModal piece={detailModalPiece} onClose={() => setDetailModalPiece(null)} />
      ) : null}

      <AyarlarBottomSheet
        visible={settingsSheetVisible}
        onClose={() => setSettingsSheetVisible(false)}
        insetsBottom={insets.bottom}
        profile={profile}
        setProfile={setProfile}
        selectedRoadEdges={selectedRoadEdges}
        clearRoadEdges={clearRoadEdges}
        uiMode={uiMode}
        setUiMode={setUiMode}
        mode={mode}
        setMode={setMode}
        targetArea={targetArea}
        setTargetArea={setTargetArea}
        targetCount={targetCount}
        setTargetCount={setTargetCount}
        orientation={orientation}
        setOrientation={setOrientation}
        onCompute={() => {
          handleCompute();
          setSettingsSheetVisible(false);
        }}
        computeDisabled={computeDisabled}
        hasPieces={pieces.length > 0}
        selectedPieceId={selectedPieceId}
        onDeletePiece={handleDeletePiece}
        onUndo={undo}
        canUndo={historyStack.length > 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: parcelSplitTheme.pageBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1e293b",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: "#3b82f6",
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerBtnDisabled: { opacity: 0.45 },
  pdfOverlay: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 100,
  },
  pdfOverlayText: {
    backgroundColor: "rgba(15,23,42,0.9)",
    color: parcelSplitTheme.textOnDark,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: "600",
  },
  pdfPieceThumbnailsHidden: {
    position: "absolute",
    left: -9999,
    top: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    opacity: 0,
  },
  headerTitle: {
    flex: 1,
    color: "#fff",
    fontWeight: "bold",
    fontSize: 20,
    textAlign: "center",
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 36 },
  roadDeleteBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(220,38,38,0.3)",
  },
  roadDeleteLabel: { fontSize: 13, fontWeight: "600", color: parcelSplitTheme.textMuted },
  roadDeleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#dc2626",
  },
  roadDeleteText: { fontSize: 13, fontWeight: "600", color: "#fff" },
  canvasWrap: { flex: 1, width: "100%", backgroundColor: parcelSplitTheme.canvasBg },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  muted: { color: parcelSplitTheme.muted, fontSize: 14 },
  edgeSlideChipsWrap: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    alignItems: "center",
  },
  edgeSlideChips: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  edgeSlideChip: {
    backgroundColor: "rgba(30,41,59,0.9)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center",
  },
  edgeSlideChipLabel: {
    fontSize: 10,
    color: parcelSplitTheme.textMuted,
    marginBottom: 2,
  },
  edgeSlideChipValue: {
    fontSize: 14,
    fontWeight: "700",
    color: parcelSplitTheme.textOnDark,
  },
  roadSlideHint: {
    fontSize: 11,
    color: parcelSplitTheme.textMuted,
    marginBottom: 4,
  },
  edgeSlideClampFeedback: {
    fontSize: 10,
    color: "#f59e0b",
    marginTop: 4,
  },
});
