import type { MeasurementMode } from "@/src/utils/measurementManager";
import type { ShapeType } from "@/src/maps/drawing/types";
import type { MeasurementSession } from "./useMeasurementSession";
import type { ShapeDrawingSession } from "../shapeDrawingModal/useShapeDrawingSession";

type ActivateOptions = {
  onBeforeActivate?: () => void;
  onAfterActivate?: () => void;
};

export function activateShapeTool(
  drawing: Pick<ShapeDrawingSession, "selectDrawTool">,
  measurement: Pick<MeasurementSession, "closeMeasurementMode">,
  next: ShapeType | null,
  options?: ActivateOptions
) {
  options?.onBeforeActivate?.();
  drawing.selectDrawTool(next);
  measurement.closeMeasurementMode();
  options?.onAfterActivate?.();
}

export function activateMeasurementTool(
  drawing: Pick<ShapeDrawingSession, "selectDrawTool">,
  measurement: Pick<MeasurementSession, "selectMeasurementMode">,
  next: MeasurementMode,
  options?: ActivateOptions
) {
  options?.onBeforeActivate?.();
  drawing.selectDrawTool(null);
  measurement.selectMeasurementMode(next);
  options?.onAfterActivate?.();
}
