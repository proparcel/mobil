import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { VrParcelPayload } from "../types/vrParcelPayload";

let Mapbox: any = null;
try {
  const mapboxModule = require("@rnmapbox/maps");
  Mapbox = mapboxModule.default || mapboxModule;
} catch {
  Mapbox = null;
}

type Props = {
  payload: VrParcelPayload;
  title?: string;
  subtitle?: string;
};

export function VrMapPreview({
  payload,
  title = "Parsel haritası",
  subtitle,
}: Props): React.ReactElement {
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

  const centerGeoJson = useMemo(
    () => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [payload.center.lon, payload.center.lat],
      },
      properties: {},
    }),
    [payload.center.lat, payload.center.lon],
  );

  if (!Mapbox?.MapView) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>Harita modülü bu build'de kullanılamıyor.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <Text style={styles.meta}>
          Ada {payload.ada} / Parsel {payload.parsel}
          {payload.areaM2 ? ` · ${payload.areaM2.toLocaleString("tr-TR")} m²` : ""}
        </Text>
      </View>
      <Mapbox.MapView
        style={styles.map}
        styleURL={Mapbox.StyleURL?.SatelliteStreet || "mapbox://styles/mapbox/satellite-streets-v12"}
        scrollEnabled
        zoomEnabled
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Mapbox.Camera
          defaultSettings={{
            centerCoordinate: [payload.center.lon, payload.center.lat],
            zoomLevel: 17,
            pitch: 0,
          }}
        />
        <Mapbox.ShapeSource id="vr-preview-polygon" shape={polygonGeoJson}>
          <Mapbox.FillLayer
            id="vr-preview-fill"
            style={{ fillColor: "rgba(59,130,246,0.28)", fillOutlineColor: "#3b82f6" }}
          />
          <Mapbox.LineLayer
            id="vr-preview-line"
            style={{ lineColor: "#60a5fa", lineWidth: 2 }}
          />
        </Mapbox.ShapeSource>
        <Mapbox.ShapeSource id="vr-preview-center" shape={centerGeoJson}>
          <Mapbox.CircleLayer
            id="vr-preview-center-dot"
            style={{ circleRadius: 6, circleColor: "#22c55e", circleStrokeColor: "#fff", circleStrokeWidth: 2 }}
          />
        </Mapbox.ShapeSource>
      </Mapbox.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b1220" },
  header: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  title: { color: "#f8fafc", fontSize: 16, fontWeight: "700" },
  subtitle: { color: "#94a3b8", fontSize: 13, lineHeight: 18 },
  meta: { color: "#64748b", fontSize: 12 },
  map: { flex: 1 },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  fallbackText: { color: "#94a3b8", textAlign: "center" },
});

export default VrMapPreview;
