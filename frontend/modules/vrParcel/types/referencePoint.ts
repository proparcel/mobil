export type VrTrackingState = "none" | "limited" | "normal";

export type GpsReferencePoint = {
  latitude: number;
  longitude: number;
  gpsAccuracyM: number;
  timestamp: string;
  arPositionX: number;
  arPositionY: number;
  arPositionZ: number;
  trackingState: VrTrackingState;
};

export type ScreenTapReferencePoint = {
  screenPointX: number;
  screenPointY: number;
  arPointX: number;
  arPointY: number;
  arPointZ: number;
};
