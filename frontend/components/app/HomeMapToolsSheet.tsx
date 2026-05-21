import React, { useEffect, useState } from "react";

import { Alert, Text, TouchableOpacity, View } from "react-native";

import { BottomSheetScrollView } from "@gorhom/bottom-sheet";

import Ionicons from "react-native-vector-icons/Ionicons";

import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

import type { MeasurementMode } from "@/src/utils/measurementManager";

import type { ShapeType } from "@/src/maps/drawing/types";

import AppBottomSheetModal from "./AppBottomSheetModal";

import { MAP_TOOLS_SHEET_BACKGROUND } from "../../src/constants/parcelPolygonDesign";

import { styles } from "./shapeDrawingModal/styles";



/** Web index «Çizim araçları» + 3D editör menüsü ile aynı seçenekler (metin hariç) */

const DRAW_SHAPE_OPTIONS: Array<{ type: ShapeType; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }> = [

  { type: "rectangle", label: "Kare", icon: "square-outline" },

  { type: "triangle", label: "Üçgen", icon: "triangle-outline" },

  { type: "circle", label: "Yuvarlak", icon: "ellipse-outline" },

  { type: "ellipse", label: "Elips", icon: "ellipse" },

  { type: "polygon", label: "Çokgen", icon: "git-merge-outline" },

  { type: "line", label: "Serbest çizim", icon: "create-outline" },

  { type: "pen", label: "Kalem çizimi", icon: "brush-outline" },

  { type: "arrow", label: "Ok", icon: "arrow-forward-outline" },

  { type: "marker", label: "Nokta", icon: "location-outline" },

];



type Props = {

  visible: boolean;

  onClose: () => void;

  insetsBottom: number;

  measurementMode: MeasurementMode;

  onSetMeasurementMode: (m: MeasurementMode) => void;

  drawShapeMode: ShapeType | null;

  onSelectDrawShape: (next: ShapeType | null) => void;

  onClearSketchShapes: () => void;

  onHisseliParsellereBol: () => void;

  onToggleEdgeMeasures: () => void | Promise<void>;

  onClearMeasurementDrawings: () => void;

  onClearAllLayers: () => void;

  hasParcelForHisseli: boolean;

  onOpenParcelPolygonDesign: () => void;

};



export function HomeMapToolsSheet({

  visible,

  onClose,

  insetsBottom,

  measurementMode,

  onSetMeasurementMode,

  drawShapeMode,

  onSelectDrawShape,

  onClearSketchShapes,

  onHisseliParsellereBol,

  onToggleEdgeMeasures,

  onClearMeasurementDrawings,

  onClearAllLayers,

  hasParcelForHisseli,

  onOpenParcelPolygonDesign,

}: Props) {

  const [parcelGroupOpen, setParcelGroupOpen] = useState(false);

  const [drawGroupOpen, setDrawGroupOpen] = useState(false);

  const [textGroupOpen, setTextGroupOpen] = useState(false);

  const [markGroupOpen, setMarkGroupOpen] = useState(false);

  const [measureGroupOpen, setMeasureGroupOpen] = useState(false);



  useEffect(() => {

    if (!visible) return;

    setParcelGroupOpen(false);

    setDrawGroupOpen(false);

    setTextGroupOpen(false);

    setMarkGroupOpen(false);

    setMeasureGroupOpen(false);

  }, [visible]);



  return (

    <AppBottomSheetModal

      visible={visible}

      onClose={onClose}

      snapPoints={["75%", "92%"]}

      initialIndex={0}

      backdropPressBehavior="close"

      backgroundStyle={MAP_TOOLS_SHEET_BACKGROUND}

      handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.35)" }}

    >

      <View style={{ flex: 1, paddingBottom: insetsBottom }}>

        <View

          style={{

            flexDirection: "row",

            alignItems: "center",

            justifyContent: "space-between",

            paddingHorizontal: 16,

            paddingVertical: 12,

            borderBottomWidth: 1,

            borderBottomColor: "#334155",

          }}

        >

          <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>Harita araçları</Text>

          <TouchableOpacity onPress={onClose} accessibilityLabel="Kapat">

            <Ionicons name="close" size={26} color="#fff" />

          </TouchableOpacity>

        </View>



        <BottomSheetScrollView

          style={{ flex: 1, paddingHorizontal: 10 }}

          contentContainerStyle={{ paddingBottom: Math.max(insetsBottom, 0) + 24 }}

        >

          <TouchableOpacity

            style={[styles.dropdownMenuItem, { backgroundColor: "rgba(51,65,85,0.5)" }]}

            onPress={() => setParcelGroupOpen((v) => !v)}

          >

            <MaterialCommunityIcons name="map-marker-path" size={18} color="#94a3b8" />

            <Text style={[styles.dropdownMenuItemText, { color: "#e2e8f0", fontWeight: "700" }]}>Parsel</Text>

            <Ionicons name={parcelGroupOpen ? "chevron-up" : "chevron-down"} size={18} color="#94a3b8" style={{ marginLeft: "auto" }} />

          </TouchableOpacity>

          {parcelGroupOpen ? (

            <>

              <TouchableOpacity

                testID="parcel-polygon-design-opt"

                style={styles.dropdownMenuItem}

                onPress={() => {

                  onClose();

                  onOpenParcelPolygonDesign();

                }}

              >

                <MaterialCommunityIcons name="vector-polygon" size={16} color="#94a3b8" />

                <Text style={styles.dropdownMenuItemText}>Parsel Poligon Tasarımı</Text>

              </TouchableOpacity>

              <TouchableOpacity

                testID="hisseli-parsellere-bol-opt"

                style={[styles.dropdownMenuItem, hasParcelForHisseli && styles.dropdownMenuItemActive]}

                onPress={() => {

                  if (!hasParcelForHisseli) {

                    Alert.alert("Uyarı", "Parsel seçiniz.");

                    return;

                  }

                  onHisseliParsellereBol();

                  onClose();

                }}

              >

                <MaterialCommunityIcons name="git-branch-outline" size={16} color={hasParcelForHisseli ? "#3b82f6" : "#94a3b8"} />

                <Text style={[styles.dropdownMenuItemText, hasParcelForHisseli && styles.dropdownMenuItemTextActive]}>

                  Hisseli Parsellere Böl

                </Text>

              </TouchableOpacity>

              <TouchableOpacity testID="show-edges-opt" style={styles.dropdownMenuItem} onPress={() => onToggleEdgeMeasures()}>

                <MaterialCommunityIcons name="vector-square" size={16} color="#94a3b8" />

                <Text style={styles.dropdownMenuItemText}>Kenar Ölçüleri</Text>

              </TouchableOpacity>

            </>

          ) : null}



          <TouchableOpacity

            style={[styles.dropdownMenuItem, { marginTop: 12, backgroundColor: "rgba(51,65,85,0.5)" }]}

            onPress={() => setDrawGroupOpen((v) => !v)}

          >

            <Ionicons name="pencil-outline" size={18} color="#94a3b8" />

            <Text style={[styles.dropdownMenuItemText, { color: "#e2e8f0", fontWeight: "700" }]}>Çizim araçları</Text>

            <Ionicons name={drawGroupOpen ? "chevron-up" : "chevron-down"} size={18} color="#94a3b8" style={{ marginLeft: "auto" }} />

          </TouchableOpacity>

          {drawGroupOpen

            ? DRAW_SHAPE_OPTIONS.map((opt) => {

                const active = drawShapeMode === opt.type;

                return (

                  <TouchableOpacity

                    key={opt.type}

                    testID={`home-draw-${opt.type}`}

                    style={[styles.dropdownMenuItem, active && styles.dropdownMenuItemActive]}

                    onPress={() => {

                      onSelectDrawShape(active ? null : opt.type);

                      onClose();

                    }}

                  >

                    <Ionicons name={opt.icon} size={16} color={active ? "#3b82f6" : "#94a3b8"} />

                    <Text style={[styles.dropdownMenuItemText, active && styles.dropdownMenuItemTextActive]}>{opt.label}</Text>

                  </TouchableOpacity>

                );

              })

            : null}

          {drawGroupOpen ? (

            <TouchableOpacity

              style={[styles.dropdownMenuItem, { borderTopWidth: 1, borderTopColor: "#334155", marginTop: 4 }]}

              onPress={() => {

                Alert.alert("Şekilleri temizle", "Haritadaki çizim şekillerini kaldırmak istiyor musunuz?", [

                  { text: "İptal", style: "cancel" },

                  {

                    text: "Temizle",

                    style: "destructive",

                    onPress: () => {

                      onClearSketchShapes();

                      onClose();

                    },

                  },

                ]);

              }}

            >

              <Ionicons name="trash-outline" size={16} color="#ef4444" />

              <Text style={styles.dropdownMenuItemText}>Şekilleri temizle</Text>

            </TouchableOpacity>

          ) : null}



          <TouchableOpacity

            style={[styles.dropdownMenuItem, { marginTop: 12, backgroundColor: "rgba(51,65,85,0.5)" }]}

            onPress={() => setTextGroupOpen((v) => !v)}

          >

            <Ionicons name="text-outline" size={18} color="#94a3b8" />

            <Text style={[styles.dropdownMenuItemText, { color: "#e2e8f0", fontWeight: "700" }]}>Metin</Text>

            <Ionicons name={textGroupOpen ? "chevron-up" : "chevron-down"} size={18} color="#94a3b8" style={{ marginLeft: "auto" }} />

          </TouchableOpacity>

          {textGroupOpen ? (

            <TouchableOpacity

              testID="home-textbox-tool-opt"

              style={[styles.dropdownMenuItem, drawShapeMode === "textbox" && styles.dropdownMenuItemActive]}

              onPress={() => {

                const active = drawShapeMode === "textbox";

                onSelectDrawShape(active ? null : "textbox");

                onClose();

              }}

            >

              <Ionicons name="chatbox-outline" size={16} color={drawShapeMode === "textbox" ? "#3b82f6" : "#94a3b8"} />

              <Text

                style={[styles.dropdownMenuItemText, drawShapeMode === "textbox" && styles.dropdownMenuItemTextActive]}

              >

                Metin kutusu ekle

              </Text>

            </TouchableOpacity>

          ) : null}



          <TouchableOpacity

            style={[styles.dropdownMenuItem, { marginTop: 12, backgroundColor: "rgba(51,65,85,0.5)" }]}

            onPress={() => setMarkGroupOpen((v) => !v)}

          >

            <Ionicons name="pricetag-outline" size={18} color="#94a3b8" />

            <Text style={[styles.dropdownMenuItemText, { color: "#e2e8f0", fontWeight: "700" }]}>İşaretleme</Text>

            <Ionicons name={markGroupOpen ? "chevron-up" : "chevron-down"} size={18} color="#94a3b8" style={{ marginLeft: "auto" }} />

          </TouchableOpacity>

          {markGroupOpen ? (

            <>

              <TouchableOpacity

                testID="pin-tool-opt"

                style={[styles.dropdownMenuItem, measurementMode === "pin" && styles.dropdownMenuItemActive]}

                onPress={() => {

                  onSetMeasurementMode(measurementMode === "pin" ? null : "pin");

                  onClose();

                }}

              >

                <MaterialCommunityIcons name="map-marker" size={16} color={measurementMode === "pin" ? "#3b82f6" : "#94a3b8"} />

                <Text style={[styles.dropdownMenuItemText, measurementMode === "pin" && styles.dropdownMenuItemTextActive]}>İğne Ekle</Text>

              </TouchableOpacity>

              <TouchableOpacity

                testID="text-tool-opt"

                style={[styles.dropdownMenuItem, measurementMode === "text" && styles.dropdownMenuItemActive]}

                onPress={() => {

                  onSetMeasurementMode(measurementMode === "text" ? null : "text");

                  onClose();

                }}

              >

                <MaterialCommunityIcons name="format-text" size={16} color={measurementMode === "text" ? "#3b82f6" : "#94a3b8"} />

                <Text style={[styles.dropdownMenuItemText, measurementMode === "text" && styles.dropdownMenuItemTextActive]}>Metin Ekle</Text>

              </TouchableOpacity>

              <TouchableOpacity

                testID="arrow-tool-opt"

                style={[styles.dropdownMenuItem, measurementMode === "arrow" && styles.dropdownMenuItemActive]}

                onPress={() => {

                  onSetMeasurementMode(measurementMode === "arrow" ? null : "arrow");

                  onClose();

                }}

              >

                <MaterialCommunityIcons name="arrow-top-right" size={16} color={measurementMode === "arrow" ? "#3b82f6" : "#94a3b8"} />

                <Text style={[styles.dropdownMenuItemText, measurementMode === "arrow" && styles.dropdownMenuItemTextActive]}>Ok Ekle</Text>

              </TouchableOpacity>

            </>

          ) : null}



          <TouchableOpacity

            style={[styles.dropdownMenuItem, { marginTop: 12, backgroundColor: "rgba(51,65,85,0.5)" }]}

            onPress={() => setMeasureGroupOpen((v) => !v)}

          >

            <Ionicons name="analytics-outline" size={18} color="#94a3b8" />

            <Text style={[styles.dropdownMenuItemText, { color: "#e2e8f0", fontWeight: "700" }]}>Ölçüm</Text>

            <Ionicons name={measureGroupOpen ? "chevron-up" : "chevron-down"} size={18} color="#94a3b8" style={{ marginLeft: "auto" }} />

          </TouchableOpacity>

          {measureGroupOpen ? (

            <>

              <TouchableOpacity

                testID="measure-distance-opt"

                style={[styles.dropdownMenuItem, measurementMode === "ruler" && styles.dropdownMenuItemActive]}

                onPress={() => {

                  onSetMeasurementMode(measurementMode === "ruler" ? null : "ruler");

                  onClose();

                }}

              >

                <MaterialCommunityIcons name="ruler" size={16} color={measurementMode === "ruler" ? "#3b82f6" : "#94a3b8"} />

                <Text style={[styles.dropdownMenuItemText, measurementMode === "ruler" && styles.dropdownMenuItemTextActive]}>Mesafe Ölçüm</Text>

              </TouchableOpacity>

              <TouchableOpacity

                testID="measure-area-opt"

                style={[styles.dropdownMenuItem, measurementMode === "area" && styles.dropdownMenuItemActive]}

                onPress={() => {

                  onSetMeasurementMode(measurementMode === "area" ? null : "area");

                  onClose();

                }}

              >

                <MaterialCommunityIcons name="ruler-square" size={16} color={measurementMode === "area" ? "#3b82f6" : "#94a3b8"} />

                <Text style={[styles.dropdownMenuItemText, measurementMode === "area" && styles.dropdownMenuItemTextActive]}>Alan Ölçüm</Text>

              </TouchableOpacity>

            </>

          ) : null}



          <TouchableOpacity

            testID="eraser-opt"

            style={[styles.dropdownMenuItem, { marginTop: 12 }]}

            onPress={() => {

              onClearMeasurementDrawings();

              onClose();

            }}

          >

            <MaterialCommunityIcons name="eraser" size={16} color="#ef4444" />

            <Text style={styles.dropdownMenuItemText}>Silgi</Text>

          </TouchableOpacity>

          <TouchableOpacity

            testID="clear-all-measurements-opt"

            style={styles.dropdownMenuItem}

            onPress={() => {

              onClearAllLayers();

              onClose();

            }}

          >

            <MaterialCommunityIcons name="broom" size={16} color="#ef4444" />

            <Text style={styles.dropdownMenuItemText}>Tümünü Temizle</Text>

          </TouchableOpacity>

        </BottomSheetScrollView>

      </View>

    </AppBottomSheetModal>

  );

}

