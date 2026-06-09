import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { VrParcelPayload } from "../types/vrParcelPayload";
import type { MapReferencePointKey, MapReferencePoints } from "../types/mapReferencePoints";
import type { VrLatLon } from "../types/vrParcelPayload";
import {
  mapPointLabel,
  validateMapReferencePair,
  validateMapReferenceTriangle,
} from "../utils/vrMapReferenceSelection";

let Mapbox: any = null;
try {
  const mapboxModule = require("@rnmapbox/maps");
  Mapbox = mapboxModule.default || mapboxModule;
} catch {
  Mapbox = null;
}

type Props = {
  payload: VrParcelPayload;
  step: MapReferencePointKey;
  partial: Partial<MapReferencePoints>;
  gpsHint?: string;
  onStepComplete: (key: MapReferencePointKey, point: VrLatLon) => void;
};

const STEP_ORDER: MapReferencePointKey[] = ["userPoint", "referenceA", "referenceB"];

function mapRefsComplete(refs: Partial<MapReferencePoints>): refs is MapReferencePoints {
  return Boolean(refs.userPoint && refs.referenceA && refs.referenceB);
}

export function VrMapReferencePicker({
  payload,
  step,
  partial,
  gpsHint,
  onStepComplete,
}: Props): React.ReactElement {
  const cameraRef = useRef<any>(null);
  const [localPartial, setLocalPartial] = useState<Partial<MapReferencePoints>>(partial);

  useEffect(() => {
    setLocalPartial(partial);
  }, [partial]);

  const polygonGeoJson = useMemo(
    () => ({
      type: "Feature" as const,
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [...payload.polygon.map((p) => [p.lon, p.lat]), [payload.polygon[0].lon, payload.polygon[0].lat]],
        ],
      },
      properties: {},
    }),
    [payload.polygon],
  );

  const markersGeoJson = useMemo(() => {
    const features = STEP_ORDER.filter((k) => localPartial[k]).map((k) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [localPartial[k]!.lon, localPartial[k]!.lat],
      },
      properties: { key: k, label: mapPointLabel(k) },
    }));
    return { type: "FeatureCollection" as const, features };
  }, [localPartial]);

  const handlePress = useCallback(
    (event: { geometry?: { coordinates?: number[] }; features?: Array<{ geometry?: { coordinates?: number[] } }> }) => {
      const coords =
        event?.geometry?.coordinates ??
        event?.features?.[0]?.geometry?.coordinates;
      if (!coords || coords.length < 2) return;
      const point: VrLatLon = { lon: coords[0], lat: coords[1] };
      const next = { ...localPartial, [step]: point };
      setLocalPartial(next);
      onStepComplete(step, point);
    },
    [localPartial, onStepComplete, step],
  );

  if (!Mapbox?.MapView) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>Harita modülü bu build'de kullanılamıyor.</Text>
      </View>
    );
  }

  const validation = validateMapReferenceTriangle(localPartial);

  const liveDistances = useMemo(() => {
    const rows: string[] = [];
    if (localPartial.userPoint && localPartial.referenceA) {
      rows.push(`Konum → A: ${validateMapReferencePair(localPartial.userPoint, localPartial.referenceA).distanceM.toFixed(1)} m`);
    }
    if (localPartial.userPoint && localPartial.referenceB) {
      rows.push(`Konum → B: ${validateMapReferencePair(localPartial.userPoint, localPartial.referenceB).distanceM.toFixed(1)} m`);
    }
    if (localPartial.referenceA && localPartial.referenceB) {
      rows.push(`A → B: ${validateMapReferencePair(localPartial.referenceA, localPartial.referenceB).distanceM.toFixed(1)} m`);
    }
    return rows;
  }, [localPartial]);

  return (
    <View style={styles.root}>
      <Mapbox.MapView
        style={styles.map}
        styleURL={Mapbox.StyleURL?.SatelliteStreet || "mapbox://styles/mapbox/satellite-streets-v12"}
        onPress={handlePress}
      >
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [payload.center.lon, payload.center.lat],
            zoomLevel: 17,
            pitch: 0,
          }}
        />
        <Mapbox.ShapeSource id="vr-parcel-polygon" shape={polygonGeoJson}>
          <Mapbox.FillLayer
            id="vr-parcel-fill"
            style={{ fillColor: "rgba(59,130,246,0.25)", fillOutlineColor: "#3b82f6" }}
          />
        </Mapbox.ShapeSource>
        <Mapbox.ShapeSource id="vr-map-markers" shape={markersGeoJson}>
          <Mapbox.CircleLayer
            id="vr-map-marker-circles"
            style={{
              circleRadius: 8,
              circleColor: [
                "match",
                ["get", "key"],
                "userPoint",
                "#22c55e",
                "referenceA",
                "#f59e0b",
                "#ef4444",
              ],
            }}
          />
        </Mapbox.ShapeSource>
      </Mapbox.MapView>

      <View style={styles.panel}>
        <Text style={styles.stepTitle}>Harita — {mapPointLabel(step)}</Text>
        <Text style={styles.stepHint}>
          Haritada {mapPointLabel(step).toLowerCase()} konumunu işaretleyin.
        </Text>
        {gpsHint ? <Text style={styles.gpsHint}>{gpsHint}</Text> : null}
        {liveDistances.length > 0 ? (
          <View style={styles.distanceBox}>
            {liveDistances.map((line) => (
              <Text key={line} style={styles.distanceLine}>
                {line}
              </Text>
            ))}
          </View>
        ) : null}
        {validation.message || step === "referenceB" ? (
          <Text
            style={[
              styles.validation,
              validation.ok && mapRefsComplete(localPartial) ? styles.validationOk : styles.validationWarn,
            ]}
          >
            {validation.message ??
              (mapRefsComplete(localPartial)
                ? "Referanslar hazır. Devam ile AR kalibrasyona geçin."
                : "Üç noktayı da işaretleyin.")}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b1220" },
  map: { flex: 1 },
  panel: {
    padding: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#334155",
    backgroundColor: "#0f172a",
    gap: 6,
  },
  stepTitle: { color: "#3b82f6", fontWeight: "700", fontSize: 13 },
  stepHint: { color: "#e2e8f0", fontSize: 14, lineHeight: 20 },
  gpsHint: { color: "#fbbf24", fontSize: 12, lineHeight: 17 },
  distanceBox: {
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    borderRadius: 8,
    padding: 8,
    gap: 2,
  },
  distanceLine: { color: "#93c5fd", fontSize: 12, fontWeight: "600" },
  validation: { fontSize: 12, lineHeight: 17 },
  validationOk: { color: "#86efac" },
  validationWarn: { color: "#fca5a5" },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  fallbackText: { color: "#94a3b8", textAlign: "center" },
});

export default VrMapReferencePicker;
