import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Line, Polygon, Rect, Text as SvgText } from "react-native-svg";
import Ionicons from "react-native-vector-icons/Ionicons";

import { useRouter } from "../../src/hooks/useNavigation";
import {
  createDroneAnnotation,
  deleteDroneAnnotation,
  droneVideoUrl,
  getDroneAnnotationExportStatus,
  listDroneAnnotations,
  listDroneEditorVideos,
  startDroneAnnotationExport,
  updateDroneAnnotation,
  type DroneAnnotation,
  type DroneAnnotationType,
  type DroneVideoArchiveRow,
} from "../../services/droneEditorService";

let Video: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const v = require("react-native-video");
  Video = v?.default || v;
} catch (e) {
  if (__DEV__) console.warn("[drone-editor.tsx] react-native-video unavailable", e);
}

const hasNativeVideoView =
  !!(UIManager as any)?.getViewManagerConfig?.("RCTVideo") ||
  !!(UIManager as any)?.getViewManagerConfig?.("RCTVideoView") ||
  !!(UIManager as any)?.getViewManagerConfig?.("ReactExoplayerView");

const TOOLS: Array<{ id: DroneAnnotationType; label: string; icon: string }> = [
  { id: "line", label: "Çizgi", icon: "remove-outline" },
  { id: "arrow", label: "Ok", icon: "arrow-forward-outline" },
  { id: "text_box", label: "Metin", icon: "text-outline" },
  { id: "map_pin", label: "Pin", icon: "location-outline" },
  { id: "price_label", label: "Fiyat", icon: "pricetag-outline" },
  { id: "area_label", label: "m²", icon: "resize-outline" },
];

function normPoint(evt: any) {
  const { locationX, locationY } = evt.nativeEvent;
  const { width, height } = evt.currentTarget._layout || {};
  const w = width || 1;
  const h = height || 1;
  return {
    x: Math.max(0, Math.min(1, locationX / w)),
    y: Math.max(0, Math.min(1, locationY / h)),
  };
}

function annotationLabel(item: DroneAnnotation) {
  return item.label || item.config_json?.label || {
    text_box: "Bilgi",
    map_pin: "Konum",
    price_label: "Fiyat",
    area_label: "m²",
    line: "Çizgi",
    arrow: "Ok",
  }[item.annotation_type];
}

export default function DroneEditorScreen() {
  const router = useRouter();
  const [videos, setVideos] = useState<DroneVideoArchiveRow[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<DroneVideoArchiveRow | null>(null);
  const [annotations, setAnnotations] = useState<DroneAnnotation[]>([]);
  const [tool, setTool] = useState<DroneAnnotationType>("line");
  const [points, setPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#f97316");
  const [pauseDuration, setPauseDuration] = useState("3");
  const [lineWidth, setLineWidth] = useState("5");
  const [loading, setLoading] = useState(true);
  const [exportStatus, setExportStatus] = useState("idle");

  const videoUri = useMemo(() => (selectedVideo?.job_id ? droneVideoUrl(selectedVideo.job_id) : ""), [selectedVideo]);

  const refreshAnnotations = useCallback(async (jobId: string) => {
    const rows = await listDroneAnnotations(jobId);
    setAnnotations(rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await listDroneEditorVideos();
        if (cancelled) return;
        setVideos(rows);
        const first = rows[0] || null;
        setSelectedVideo(first);
        if (first?.job_id) {
          await refreshAnnotations(first.job_id);
          setExportStatus(await getDroneAnnotationExportStatus(first.job_id));
        }
      } catch (e: any) {
        if (!cancelled) Alert.alert("Hata", e?.message || "Drone videoları alınamadı.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshAnnotations]);

  const onVideoSelect = useCallback(async (video: DroneVideoArchiveRow) => {
    setSelectedVideo(video);
    setPoints([]);
    await refreshAnnotations(video.job_id);
    setExportStatus(await getDroneAnnotationExportStatus(video.job_id));
  }, [refreshAnnotations]);

  const onTapPreview = useCallback((evt: any) => {
    const p = normPoint(evt);
    if (tool === "line" || tool === "arrow") {
      setPoints((prev) => [...prev, p].slice(-2));
    } else {
      setPoints([p]);
    }
  }, [tool]);

  const onSave = useCallback(async () => {
    if (!selectedVideo?.job_id) return;
    const needsTwo = tool === "line" || tool === "arrow";
    if ((needsTwo && points.length < 2) || (!needsTwo && points.length < 1)) {
      Alert.alert("Eksik", needsTwo ? "İlk ve ikinci noktaya dokunun." : "Video üzerinde konum seçin.");
      return;
    }
    try {
      const ann = await createDroneAnnotation({
        job_id: selectedVideo.job_id,
        annotation_type: tool,
        start_time: currentTime,
        pause_duration: Number(pauseDuration) || 3,
        color,
        line_width: Number(lineWidth) || 5,
        label,
        animation_in: "fade",
        animation_out: "fade",
        config_json: needsTwo ? { points, label, fontSize: 26 } : { point: points[0], label, fontSize: 26, iconType: "pin" },
      });
      setAnnotations((prev) => [...prev, ann]);
      setPoints([]);
      Alert.alert("Kaydedildi", "Annotation video zaman çizgisine eklendi.");
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Kaydedilemedi.");
    }
  }, [color, currentTime, label, lineWidth, pauseDuration, points, selectedVideo, tool]);

  const onExport = useCallback(async () => {
    if (!selectedVideo?.job_id) return;
    try {
      const status = await startDroneAnnotationExport(selectedVideo.job_id);
      setExportStatus(status);
      Alert.alert("Başladı", "Video export kuyruğa alındı.");
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Export başlatılamadı.");
    }
  }, [selectedVideo]);

  async function onDelete(item: DroneAnnotation) {
    try {
      await deleteDroneAnnotation(item.id);
      setAnnotations((prev) => prev.filter((row) => row.id !== item.id));
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Silinemedi.");
    }
  }

  async function quickUpdate(item: DroneAnnotation) {
    try {
      const updated = await updateDroneAnnotation({
        id: item.id,
        label,
        color,
        line_width: Number(lineWidth) || item.line_width,
        pause_duration: Number(pauseDuration) || item.pause_duration,
      });
      setAnnotations((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Güncellenemedi.");
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ flex: 1 }} size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color="#0f172a" /></TouchableOpacity>
        <Text style={styles.title}>Drone Editor</Text>
        <TouchableOpacity onPress={onExport}><Text style={styles.export}>Export</Text></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.videoPicker}>
          {videos.map((video) => (
            <TouchableOpacity key={video.job_id} style={[styles.videoChip, selectedVideo?.job_id === video.job_id && styles.videoChipActive]} onPress={() => onVideoSelect(video)}>
              <Text style={styles.videoChipText}>{video.label || video.reference_id || "Drone Video"}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.preview} onLayout={(e) => ((e.currentTarget as any)._layout = e.nativeEvent.layout)} onStartShouldSetResponder={() => true} onResponderRelease={onTapPreview}>
          {videoUri && Video && hasNativeVideoView ? (
            <Video source={{ uri: videoUri }} style={StyleSheet.absoluteFill} controls resizeMode="contain" onProgress={(p: any) => setCurrentTime(Number(p?.currentTime || 0))} />
          ) : (
            <View style={styles.noVideo}><Text style={styles.noVideoText}>{videoUri ? "Video önizleme modülü yok" : "Video seçin"}</Text></View>
          )}
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            {annotations.map((item) => renderAnnotation(item))}
            {points.map((p, idx) => <Circle key={`draft-${idx}`} cx={`${p.x * 100}%`} cy={`${p.y * 100}%`} r="7" fill={color} />)}
            {points.length === 2 ? <Line x1={`${points[0].x * 100}%`} y1={`${points[0].y * 100}%`} x2={`${points[1].x * 100}%`} y2={`${points[1].y * 100}%`} stroke={color} strokeWidth={Number(lineWidth) || 5} strokeDasharray="8 6" /> : null}
          </Svg>
        </View>

        <View style={styles.timeline}>
          <Text style={styles.time}>{currentTime.toFixed(1)} sn</Text>
          <Text style={styles.timelineHint}>Videoyu durdurun, aracı seçin, noktaya dokunun.</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tools}>
          {TOOLS.map((item) => (
            <TouchableOpacity key={item.id} style={[styles.tool, tool === item.id && styles.toolActive]} onPress={() => { setTool(item.id); setPoints([]); }}>
              <Ionicons name={item.icon as any} size={18} color={tool === item.id ? "#fff" : "#2563eb"} />
              <Text style={[styles.toolText, tool === item.id && styles.toolTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Annotation Ayarları</Text>
          <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="Label: Yol cephesi, elektrik hattı..." placeholderTextColor="#94a3b8" />
          <View style={styles.row}>
            <TextInput style={[styles.input, styles.smallInput]} value={color} onChangeText={setColor} placeholder="#f97316" />
            <TextInput style={[styles.input, styles.smallInput]} value={lineWidth} onChangeText={setLineWidth} keyboardType="numeric" placeholder="Kalınlık" />
            <TextInput style={[styles.input, styles.smallInput]} value={pauseDuration} onChangeText={setPauseDuration} keyboardType="numeric" placeholder="Süre" />
          </View>
          <TouchableOpacity style={styles.primary} onPress={onSave}><Text style={styles.primaryText}>Annotation Kaydet</Text></TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Saved Annotations · Export: {exportStatus}</Text>
          {annotations.map((item) => (
            <View key={item.id} style={styles.savedRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.savedTitle}>{annotationLabel(item)}</Text>
                <Text style={styles.savedMeta}>{item.start_time.toFixed(1)} sn · {item.pause_duration}s</Text>
              </View>
              <TouchableOpacity onPress={() => quickUpdate(item)}><Text style={styles.edit}>Edit</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => onDelete(item)}><Text style={styles.delete}>Delete</Text></TouchableOpacity>
            </View>
          ))}
          {!annotations.length ? <Text style={styles.empty}>Henüz annotation yok.</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function renderAnnotation(item: DroneAnnotation) {
  const color = item.color || "#f97316";
  if (item.annotation_type === "line" || item.annotation_type === "arrow") {
    const pts = item.config_json?.points || [];
    if (pts.length < 2) return null;
    return (
      <React.Fragment key={item.id}>
        <Line x1={`${pts[0].x * 100}%`} y1={`${pts[0].y * 100}%`} x2={`${pts[1].x * 100}%`} y2={`${pts[1].y * 100}%`} stroke={color} strokeWidth={item.line_width || 4} />
        {item.annotation_type === "arrow" ? <Polygon points={`${pts[1].x * 100},${pts[1].y * 100} ${pts[1].x * 100 - 2},${pts[1].y * 100 - 2} ${pts[1].x * 100 - 2},${pts[1].y * 100 + 2}`} fill={color} /> : null}
      </React.Fragment>
    );
  }
  const p = item.config_json?.point || { x: 0.5, y: 0.5 };
  return (
    <React.Fragment key={item.id}>
      <Rect x={`${p.x * 100 - 8}%`} y={`${p.y * 100 - 3}%`} width="80" height="28" rx="8" fill="rgba(15,23,42,0.86)" stroke={color} strokeWidth="2" />
      <SvgText x={`${p.x * 100 - 6}%`} y={`${p.y * 100 + 2}%`} fill="#fff" fontSize="14" fontWeight="700">{annotationLabel(item)}</SvgText>
    </React.Fragment>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  title: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  export: { fontWeight: "800", color: "#2563eb" },
  scroll: { padding: 14, gap: 12, paddingBottom: 36 },
  videoPicker: { gap: 8 },
  videoChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "#e2e8f0" },
  videoChipActive: { backgroundColor: "#2563eb" },
  videoChipText: { color: "#0f172a", fontWeight: "700" },
  preview: { height: 260, backgroundColor: "#020617", borderRadius: 18, overflow: "hidden" },
  noVideo: { flex: 1, alignItems: "center", justifyContent: "center" },
  noVideoText: { color: "#94a3b8" },
  timeline: { backgroundColor: "#fff", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  time: { fontWeight: "800", color: "#0f172a" },
  timelineHint: { color: "#64748b", marginTop: 4 },
  tools: { gap: 8 },
  tool: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dbeafe" },
  toolActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  toolText: { color: "#2563eb", fontWeight: "800" },
  toolTextActive: { color: "#fff" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#e2e8f0" },
  cardTitle: { fontWeight: "800", color: "#0f172a", marginBottom: 10 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, padding: 10, color: "#0f172a", marginBottom: 8 },
  row: { flexDirection: "row", gap: 8 },
  smallInput: { flex: 1 },
  primary: { backgroundColor: "#2563eb", padding: 13, borderRadius: 12, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "800" },
  savedRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  savedTitle: { color: "#0f172a", fontWeight: "800" },
  savedMeta: { color: "#64748b", marginTop: 2 },
  edit: { color: "#2563eb", fontWeight: "800" },
  delete: { color: "#dc2626", fontWeight: "800" },
  empty: { color: "#64748b" },
});
