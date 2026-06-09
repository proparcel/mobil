export type CalibrationTransform = {
  originLat: number;
  originLon: number;
  rotationYaw: number;
  rotationYawRad?: number;
  translationX: number;
  translationY: number;
  translationZ: number;
  scale: number;
  /** @deprecated qualityScore kullanın */
  accuracyScore: number;
  qualityScore: number;
  mode: import("./vrCalibrationMode").VrCalibrationMode;
  mapReferences?: import("./mapReferencePoints").MapReferencePoints;
  arReferences?: import("./mapReferencePoints").ArReferencePoints;
  createdAt: string;
  calibrationHeadingDeg?: number;
  fineTuneEastM?: number;
  fineTuneNorthM?: number;
  fineTuneYawDeg?: number;
};
