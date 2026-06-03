import React, { useState } from "react";

import { Alert, Text, TouchableOpacity, View } from "react-native";

import Ionicons from "react-native-vector-icons/Ionicons";

import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";

import type { ShapeType } from "@/src/maps/drawing/types";

import type { MapPinVariant } from "@/src/maps/drawing/mapPinStyles";

import type { MapArrowVariant } from "@/src/maps/drawing/mapArrowStyles";

import {

  getShapeDrawOptionsForSurface,

  MARKER_DRAW_OPTION,

  TEXTBOX_DRAW_OPTION,

} from "./mapDrawToolOptions";

import { PinStylePicker } from "./PinStylePicker";

import { ArrowStylePicker } from "./ArrowStylePicker";

import { styles } from "./styles";



type Props = {

  shapeDrawingMode: ShapeType | null;

  onSelectShape: (next: ShapeType | null) => void;

  onClearShapes?: () => void;

  onClose?: () => void;

  surface?: "home" | "editor";

  clearConfirmMessage?: string;

  drawPinVariant?: MapPinVariant;

  onSelectPinVariant?: (variant: MapPinVariant) => void;

  drawArrowVariant?: MapArrowVariant;

  onSelectArrowVariant?: (variant: MapArrowVariant) => void;

};



export function MapDrawToolsSection({

  shapeDrawingMode,

  onSelectShape,

  onClearShapes,

  onClose,

  surface = "editor",

  clearConfirmMessage = "Tüm çizim şekillerini kaldırmak istiyor musunuz?",

  drawPinVariant = "classic",

  onSelectPinVariant,

  drawArrowVariant = "classic",

  onSelectArrowVariant,

}: Props) {

  const [drawGroupOpen, setDrawGroupOpen] = useState(false);

  const [textGroupOpen, setTextGroupOpen] = useState(false);



  const shapeOptions = getShapeDrawOptionsForSurface(surface);

  const testIdPrefix = surface === "home" ? "home-draw" : undefined;

  const markerActive = shapeDrawingMode === "marker";

  const arrowActive = shapeDrawingMode === "arrow";



  const handleSelect = (next: ShapeType | null) => {
    onSelectShape(next);
  };



  const handlePinVariantSelect = (variant: MapPinVariant) => {

    onSelectPinVariant?.(variant);

    if (!markerActive) {

      handleSelect("marker");

    }

  };

  const handleArrowVariantSelect = (variant: MapArrowVariant) => {

    onSelectArrowVariant?.(variant);

    if (!arrowActive) {

      handleSelect("arrow");

    }

  };



  const toggleMarkerMode = () => {

    handleSelect(markerActive ? null : "marker");

  };



  return (

    <>

      <TouchableOpacity

        style={[styles.dropdownMenuItem, { backgroundColor: "rgba(51,65,85,0.5)" }]}

        onPress={() => setDrawGroupOpen((v) => !v)}

      >

        <Ionicons name="pencil-outline" size={18} color="#94a3b8" />

        <Text style={[styles.dropdownMenuItemText, { color: "#e2e8f0", fontWeight: "700" }]}>Çizim araçları</Text>

        <Ionicons name={drawGroupOpen ? "chevron-up" : "chevron-down"} size={18} color="#94a3b8" style={{ marginLeft: "auto" }} />

      </TouchableOpacity>

      {drawGroupOpen ? (

        <>

          <TouchableOpacity

            testID={testIdPrefix ? `${testIdPrefix}-marker` : undefined}

            style={[styles.dropdownMenuItem, markerActive && styles.dropdownMenuItemActive]}

            onPress={toggleMarkerMode}

          >

            <MaterialCommunityIcons

              name={MARKER_DRAW_OPTION.icon}

              size={16}

              color={markerActive ? "#3b82f6" : "#94a3b8"}

            />

            <Text style={[styles.dropdownMenuItemText, markerActive && styles.dropdownMenuItemTextActive]}>

              {MARKER_DRAW_OPTION.label}

            </Text>

          </TouchableOpacity>

          <View style={{ marginLeft: 8, marginRight: 4, marginBottom: 6 }}>

            <PinStylePicker selected={drawPinVariant} onSelect={handlePinVariantSelect} compact />

          </View>



          {shapeOptions.map((opt) => {

            if (opt.type === "arrow") {
              return (
                <React.Fragment key={opt.type}>
                  <TouchableOpacity

                    testID={testIdPrefix ? `${testIdPrefix}-${opt.type}` : undefined}

                    style={[styles.dropdownMenuItem, arrowActive && styles.dropdownMenuItemActive]}

                    onPress={() => handleSelect(arrowActive ? null : "arrow")}

                  >

                    <Ionicons name={opt.icon} size={16} color={arrowActive ? "#3b82f6" : "#94a3b8"} />

                    <Text style={[styles.dropdownMenuItemText, arrowActive && styles.dropdownMenuItemTextActive]}>

                      {opt.label}

                    </Text>

                  </TouchableOpacity>

                  <View style={{ marginLeft: 8, marginRight: 4, marginBottom: 6 }}>

                    <ArrowStylePicker

                      selected={drawArrowVariant}

                      onSelect={handleArrowVariantSelect}

                      compact

                    />

                  </View>
                </React.Fragment>
              );
            }

            const active = shapeDrawingMode === opt.type;

            return (

              <TouchableOpacity

                key={opt.type}

                testID={testIdPrefix ? `${testIdPrefix}-${opt.type}` : undefined}

                style={[styles.dropdownMenuItem, active && styles.dropdownMenuItemActive]}

                onPress={() => handleSelect(active ? null : opt.type)}

              >

                <Ionicons name={opt.icon} size={16} color={active ? "#3b82f6" : "#94a3b8"} />

                <Text style={[styles.dropdownMenuItemText, active && styles.dropdownMenuItemTextActive]}>{opt.label}</Text>

              </TouchableOpacity>

            );

          })}

        </>

      ) : null}

      {drawGroupOpen && onClearShapes ? (

        <TouchableOpacity

          style={[styles.dropdownMenuItem, { borderTopWidth: 1, borderTopColor: "#334155", marginTop: 4 }]}

          onPress={() => {

            Alert.alert("Şekilleri temizle", clearConfirmMessage, [

              { text: "İptal", style: "cancel" },

              {

                text: "Temizle",

                style: "destructive",

                onPress: () => {

                  onClearShapes();

                  onClose?.();

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

          testID={surface === "home" ? "home-textbox-tool-opt" : undefined}

          style={[styles.dropdownMenuItem, shapeDrawingMode === "textbox" && styles.dropdownMenuItemActive]}

          onPress={() => {

            const active = shapeDrawingMode === "textbox";

            handleSelect(active ? null : "textbox");

          }}

        >

          <Ionicons name={TEXTBOX_DRAW_OPTION.icon} size={16} color={shapeDrawingMode === "textbox" ? "#3b82f6" : "#94a3b8"} />

          <Text style={[styles.dropdownMenuItemText, shapeDrawingMode === "textbox" && styles.dropdownMenuItemTextActive]}>

            {TEXTBOX_DRAW_OPTION.label}

          </Text>

        </TouchableOpacity>

      ) : null}

    </>

  );

}


