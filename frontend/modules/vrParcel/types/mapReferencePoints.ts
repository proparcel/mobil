import type { VrLatLon } from "./vrParcelPayload";

export type MapReferencePointKey = "userPoint" | "referenceA" | "referenceB";

export type MapReferencePoints = {
  userPoint: VrLatLon;
  referenceA: VrLatLon;
  referenceB: VrLatLon;
};

export type ArReferencePoints = {
  userPoint: { x: number; y: number; z: number };
  referenceA: { x: number; y: number; z: number };
  referenceB: { x: number; y: number; z: number };
};

export type VrSessionPayload = {
  parcel: import("./vrParcelPayload").VrParcelPayload;
  mode: import("./vrCalibrationMode").VrCalibrationMode;
  mapReferences: MapReferencePoints;
};
