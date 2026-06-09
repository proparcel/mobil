import React from "react";
import { VrCalibrationFlow } from "../components/VrCalibrationFlow";
import type { VrParcelPayload } from "../types/vrParcelPayload";
import type { VrDeviceCapabilities } from "../utils/vrDeviceCapabilities";
import type { VrCalibrationMode } from "../types/vrCalibrationMode";

type Props = {
  payload: VrParcelPayload;
  capabilities: VrDeviceCapabilities;
  mode: VrCalibrationMode;
  onClose: () => void;
};

export default function VrParcelScreenContent({
  payload,
  capabilities,
  mode,
  onClose,
}: Props): React.ReactElement {
  return (
    <VrCalibrationFlow
      payload={payload}
      capabilities={capabilities}
      mode={mode}
      onClose={onClose}
    />
  );
}
