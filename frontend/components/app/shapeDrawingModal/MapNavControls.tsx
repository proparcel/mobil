import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { styles } from "./styles";

type Props = {
  visible: boolean;
  bottomInset: number;
  pitchValue: number;
  onOpen: () => void;
  onClose: () => void;

  startZoomChange: (delta: number) => void;
  stopZoomChange: () => void;
  startHeadingChange: (delta: number) => void;
  stopHeadingChange: () => void;
  startPitchChange: (delta: number) => void;
  stopPitchChange: () => void;
};

export const MapNavControls: React.FC<Props> = ({
  visible,
  bottomInset,
  pitchValue,
  onOpen,
  onClose,
  startZoomChange,
  stopZoomChange,
  startHeadingChange,
  stopHeadingChange,
  startPitchChange,
  stopPitchChange,
}) => {
  if (!visible) {
    return (
      <View style={[styles.navControlsWrapper, { bottom: Math.max(bottomInset, 0) + 12 }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.navControlsTogglePill} onPress={onOpen} activeOpacity={0.85}>
          <Ionicons name="options-outline" size={16} color="#e2e8f0" />
          <Text style={styles.navControlsToggleText}>Kontroller</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.navControlsWrapper, { bottom: Math.max(bottomInset, 0) + 12 }]} pointerEvents="box-none">
      <View style={styles.controlsLayoutWrapper} pointerEvents="box-none">
        {/* Zoom + Heading grid */}
        <View style={styles.mapControlsPanel} pointerEvents="auto">
          <View style={styles.mapControlsRow}>
            <View style={styles.mapControlSpacer} />
            <TouchableOpacity onPressIn={() => startZoomChange(1.0)} onPressOut={stopZoomChange} style={styles.mapControlButton}>
              <Ionicons name="chevron-up" size={20} color="#3b82f6" />
            </TouchableOpacity>
            <View style={styles.mapControlSpacer} />
          </View>
          <View style={styles.mapControlsRow}>
            <TouchableOpacity onPressIn={() => startHeadingChange(15)} onPressOut={stopHeadingChange} style={styles.mapControlButton}>
              <Ionicons name="chevron-back" size={20} color="#3b82f6" />
            </TouchableOpacity>
            <View style={styles.mapControlSpacer} />
            <TouchableOpacity onPressIn={() => startHeadingChange(-15)} onPressOut={stopHeadingChange} style={styles.mapControlButton}>
              <Ionicons name="chevron-forward" size={20} color="#3b82f6" />
            </TouchableOpacity>
          </View>
          <View style={styles.mapControlsRow}>
            <View style={styles.mapControlSpacer} />
            <TouchableOpacity onPressIn={() => startZoomChange(-1.0)} onPressOut={stopZoomChange} style={styles.mapControlButton}>
              <Ionicons name="chevron-down" size={20} color="#3b82f6" />
            </TouchableOpacity>
            <View style={styles.mapControlSpacer} />
          </View>
        </View>

        {/* Pitch controls */}
        <View style={styles.pitchControlsContainer} pointerEvents="auto">
          <TouchableOpacity onPressIn={() => startPitchChange(5)} onPressOut={stopPitchChange} style={styles.pitchButton}>
            <Ionicons name="add" size={20} color="#3b82f6" />
          </TouchableOpacity>
          <Text style={styles.pitchValue}>{Math.round(pitchValue)}°</Text>
          <TouchableOpacity onPressIn={() => startPitchChange(-5)} onPressOut={stopPitchChange} style={styles.pitchButton}>
            <Ionicons name="remove" size={20} color="#3b82f6" />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={styles.navControlsTogglePill}
        onPress={() => {
          stopHeadingChange();
          stopZoomChange();
          stopPitchChange();
          onClose();
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="chevron-down" size={16} color="#e2e8f0" />
        <Text style={styles.navControlsToggleText}>Kapat</Text>
      </TouchableOpacity>
    </View>
  );
};

