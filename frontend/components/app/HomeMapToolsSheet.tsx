import type { MeasurementMode } from "@/src/utils/measurementManager";
import type { ShapeType } from "@/src/maps/drawing/types";
import type { MapPinVariant } from "@/src/maps/drawing/mapPinStyles";
import type { MapArrowVariant } from "@/src/maps/drawing/mapArrowStyles";
import { MapToolsSheet } from "./mapTools/MapToolsSheet";

type Props = {
  visible: boolean;
  onClose: () => void;
  insetsBottom: number;
  measurementMode: MeasurementMode;
  onSetMeasurementMode: (m: MeasurementMode) => void;
  drawShapeMode: ShapeType | null;
  onSelectDrawShape: (next: ShapeType | null) => void;
  drawPinVariant?: MapPinVariant;
  onSelectPinVariant?: (variant: MapPinVariant) => void;
  drawArrowVariant?: MapArrowVariant;
  onSelectArrowVariant?: (variant: MapArrowVariant) => void;
  onClearSketchShapes: () => void;
  onHisseliParsellereBol: () => void;
  onToggleEdgeMeasures: () => void | Promise<void>;
  onClearMeasurementDrawings: () => void;
  onClearAllLayers: () => void;
  hasParcelForHisseli: boolean;
  onOpenParcelPolygonDesign: () => void;
};

/** @deprecated Use MapToolsSheet with surface="home" directly. Thin wrapper for index.tsx. */
export function HomeMapToolsSheet({
  visible,
  onClose,
  insetsBottom,
  measurementMode,
  onSetMeasurementMode,
  drawShapeMode,
  onSelectDrawShape,
  drawPinVariant,
  onSelectPinVariant,
  drawArrowVariant,
  onSelectArrowVariant,
  onClearSketchShapes,
  onHisseliParsellereBol,
  onToggleEdgeMeasures,
  onClearMeasurementDrawings,
  onClearAllLayers,
  hasParcelForHisseli,
  onOpenParcelPolygonDesign,
}: Props) {
  return (
    <MapToolsSheet
      visible={visible}
      onClose={onClose}
      surface="home"
      insetsBottom={insetsBottom}
      shapeDrawingMode={drawShapeMode}
      measurementMode={measurementMode}
      onSelectShape={onSelectDrawShape}
      drawPinVariant={drawPinVariant}
      onSelectPinVariant={onSelectPinVariant}
      drawArrowVariant={drawArrowVariant}
      onSelectArrowVariant={onSelectArrowVariant}
      onSelectMeasurement={onSetMeasurementMode}
      onClearShapes={onClearSketchShapes}
      onClearMeasurements={onClearMeasurementDrawings}
      onClearAllLayers={onClearAllLayers}
      onOpenParcelPolygonDesign={onOpenParcelPolygonDesign}
      onHisseliParsellereBol={onHisseliParsellereBol}
      hasParcelForHisseli={hasParcelForHisseli}
      onToggleEdgeMeasures={onToggleEdgeMeasures}
    />
  );
}
