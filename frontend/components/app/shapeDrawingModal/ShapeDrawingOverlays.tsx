import React, { useRef } from "react";
import { View, StyleSheet } from "react-native";
import { ShapesLayer } from "@/src/maps/drawing/ShapesLayer";
import { ScreenShapesOverlay } from "./ScreenShapesOverlay";
import { TextBoxMapOverlay } from "./TextBoxMapOverlay";
import { PinMapOverlay } from "./PinMapOverlay";
import { ShapeMapOverlay } from "@/src/maps/drawing/ShapeMapOverlay";
import { FreehandDrawOverlay } from "./FreehandDrawOverlay";
import { ModeInfoBar } from "./ModeInfoBar";
import { DrawingFinishBar } from "./DrawingFinishBar";
import { ShapeEditSheet } from "./ShapeEditSheet";
import type { ShapeDrawingSession } from "./useShapeDrawingSession";
import { ShapeDraftPreviewLayers } from "./ShapeDraftPreviewLayers";

type MapLayersProps = {
  session: ShapeDrawingSession;
  Mapbox: any;
  idPrefix?: string;
  interactionLocked?: boolean;
  onHandlePress?: (shapeId: string, handleIndex: number) => void;
};

/** MapView içine yerleştirilir. */
export function ShapeDrawingMapLayers({
  session,
  Mapbox,
  idPrefix = "shape-draw",
  interactionLocked = false,
  onHandlePress,
}: MapLayersProps) {
  const {
    shapes,
    selectedShapeId,
    shapeDrawingMode,
    shapeDrawingPoints,
    shapeDraftPreview,
    drawOutlineColor,
    handleShapeTap,
    freehandActive,
  } = session;

  const penLocked = freehandActive || shapeDrawingMode === "pen";

  return (
    <>
      <ShapesLayer
        shapes={shapes}
        selectedShapeId={selectedShapeId}
        onShapePress={(id) => {
          if (penLocked) return;
          handleShapeTap(id);
        }}
        onHandlePress={onHandlePress}
        Mapbox={Mapbox}
        interactionLocked={interactionLocked || penLocked}
      />
      {shapeDraftPreview ? (
        <ShapeDraftPreviewLayers
          Mapbox={Mapbox}
          preview={shapeDraftPreview}
          idPrefix={`${idPrefix}-draft`}
          outlineColor={drawOutlineColor}
        />
      ) : null}
    </>
  );
}

type UiOverlaysProps = {
  session: ShapeDrawingSession;
  mapRef: React.RefObject<any>;
  insetsBottom: number;
  /** Ölçüm / çizim / metin kutusu vb. aktifken harita objeleri seçilemez */
  mapInteractionLocked?: boolean;
  /** Ölçüm modu aktifken textbox overlay kapalı (mapInteractionLocked alt kümesi) */
  measurementActive?: boolean;
  /** captureMode vb. */
  uiHidden?: boolean;
  modeInfoBottomOffset?: number;
  finishBarVisible?: boolean;
  finishBarPlacement?: "top" | "bottom";
  finishBarTopOffset?: number;
  finishBarLabel?: string;
  insetsTop?: number;
  onFinishMeasurement?: () => void;
  measurementFinishLabel?: string;
  /** false: ShapeEditSheet dışarıda (3D editör kök seviyesinde) render edilir */
  renderShapeEditSheet?: boolean;
  /** Verilmezse yalnızca shapeDrawingMode için gösterilir (ana harita) */
  modeInfoVisible?: boolean;
  measurementMode?: "distance" | "area" | null;
  parcelSelectMode?: boolean;
  resizeMode?: unknown;
  rotationMode?: unknown;
};

/** MapView kardeşi — mutlak konumlu overlay'ler + ShapeEditSheet. */
export function ShapeDrawingUiOverlays({
  session,
  mapRef,
  insetsBottom,
  mapInteractionLocked = false,
  measurementActive = false,
  uiHidden = false,
  modeInfoBottomOffset,
  finishBarVisible = true,
  finishBarPlacement = "bottom",
  finishBarTopOffset = 8,
  finishBarLabel,
  insetsTop = 0,
  onFinishMeasurement,
  measurementFinishLabel = "Ölçümü bitir",
  renderShapeEditSheet = true,
  modeInfoVisible,
  measurementMode = null,
  parcelSelectMode = false,
  resizeMode = false,
  rotationMode = false,
}: UiOverlaysProps) {
  const {
    shapes,
    selectedShapeId,
    shapeDrawingMode,
    shapeEditPanelVisible,
    shapeEditPanelMinimized,
    setShapeEditPanelMinimized,
    textBoxLayoutTick,
    mapOverlayViewport,
    setMapOverlayViewport,
    handleShapeTap,
    handleFinishActiveDrawing,
    handleDeleteSelectedShape,
    openTextBoxEditor,
    clearShapeSelection,
    exitDrawToolMode,
    setShapes,
    handleFreehandCommitMap,
    handleFreehandCommitScreen,
    drawSurface,
    setDrawSurface,
    drawOutlineColor,
    drawOutlineWidth,
    freehandActive,
  } = session;

  const overlayRootRef = useRef<View>(null);

  const showMapOverlays = !freehandActive && (uiHidden || !mapInteractionLocked);

  const blockShapePress = freehandActive || mapInteractionLocked || uiHidden;

  const bottomOffset = modeInfoBottomOffset ?? 88 + insetsBottom;
  const showModeInfoBar =
    modeInfoVisible ?? Boolean(shapeDrawingMode && !measurementActive);

  return (
    <>
      <View
        ref={overlayRootRef}
        style={StyleSheet.absoluteFill}
        pointerEvents="box-none"
        collapsable={false}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 1 && height > 1) {
            setMapOverlayViewport((prev) =>
              prev.width === width && prev.height === height ? prev : { width, height }
            );
          }
        }}
      >
      <ScreenShapesOverlay
        shapes={shapes}
        selectedShapeId={selectedShapeId}
        interactionLocked={blockShapePress}
        onShapePress={(id) => {
          if (blockShapePress) return;
          handleShapeTap(id);
        }}
      />
      <ShapeMapOverlay
        shapes={shapes}
        mapRef={mapRef}
        layoutTick={textBoxLayoutTick}
        selectedShapeId={selectedShapeId}
        viewport={mapOverlayViewport}
        onShapePress={(id) => {
          if (blockShapePress) return;
          handleShapeTap(id);
        }}
        enabled={showMapOverlays}
      />
      <TextBoxMapOverlay
        shapes={shapes}
        mapRef={mapRef}
        layoutTick={textBoxLayoutTick}
        viewport={mapOverlayViewport}
        selectedShapeId={selectedShapeId}
        onShapePress={(id) => {
          if (blockShapePress) return;
          handleShapeTap(id);
        }}
        enabled={showMapOverlays}
      />
      <PinMapOverlay
        shapes={shapes}
        mapRef={mapRef}
        layoutTick={textBoxLayoutTick}
        viewport={mapOverlayViewport}
        selectedShapeId={selectedShapeId}
        onShapePress={(id) => {
          if (blockShapePress) return;
          handleShapeTap(id);
        }}
        enabled={showMapOverlays}
      />
      {!uiHidden ? (
        <FreehandDrawOverlay
          active={freehandActive}
          mode={shapeDrawingMode === "freehand" ? "freehand" : "pen"}
          drawSurface={drawSurface}
          mapRef={mapRef}
          onCommitMap={handleFreehandCommitMap}
          onCommitScreen={handleFreehandCommitScreen}
          strokePreviewColor={drawOutlineColor}
          strokeWidth={Math.max(2, drawOutlineWidth)}
        />
      ) : null}
      </View>
      {!uiHidden && showModeInfoBar ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: bottomOffset,
            zIndex: 1240,
          }}
        >
          <ModeInfoBar
            visible
            shapeDrawingMode={shapeDrawingMode}
            measurementMode={measurementMode}
            parcelSelectMode={parcelSelectMode}
            resizeMode={resizeMode}
            rotationMode={rotationMode}
            drawSurface={drawSurface}
            onToggleDrawSurface={() => setDrawSurface((s) => (s === "map" ? "screen" : "map"))}
            showDrawSurfaceToggle={shapeDrawingMode === "pen" || shapeDrawingMode === "freehand"}
          />
        </View>
      ) : null}
      {!uiHidden && finishBarVisible && measurementActive && onFinishMeasurement ? (
        <DrawingFinishBar
          visible
          bottomInset={insetsBottom}
          label={measurementFinishLabel}
          placement="top"
          topOffset={Math.max(8, insetsTop) + finishBarTopOffset}
          onFinish={onFinishMeasurement}
        />
      ) : null}
      {!uiHidden && finishBarVisible ? (
        <DrawingFinishBar
          visible={Boolean(shapeDrawingMode)}
          bottomInset={insetsBottom}
          label={finishBarLabel}
          placement={finishBarPlacement}
          topOffset={finishBarTopOffset}
          onFinish={handleFinishActiveDrawing}
        />
      ) : null}
      {!uiHidden && renderShapeEditSheet ? (
        <ShapeEditSheet
          visible={shapeEditPanelVisible}
          selectedShapeId={selectedShapeId}
          shapes={shapes}
          setShapes={setShapes}
          insetsBottom={insetsBottom}
          minimized={shapeEditPanelMinimized}
          setMinimized={setShapeEditPanelMinimized}
          onClose={() => {
            clearShapeSelection();
            if (shapeDrawingMode === "marker") {
              exitDrawToolMode();
            }
          }}
          onDeleteShape={handleDeleteSelectedShape}
          openTextBoxEditor={openTextBoxEditor}
        />
      ) : null}
    </>
  );
}
