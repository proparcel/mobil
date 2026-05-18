import React from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import Ionicons from "react-native-vector-icons/Ionicons";
import AppBottomSheetModal from "../AppBottomSheetModal";
import { styles } from "./styles";

type TabKey = "shapes" | "measurements" | "parcels";

type Props = {
  visible: boolean;
  onClose: () => void;
  insetsBottom: number;

  activeTab: TabKey;
  setActiveTab: (t: TabKey) => void;

  shapes: any[];
  measurementFeatures: any[];
  parcels: any[];

  selectedShapeId: string | null;
  selectedParcelId: any;

  getShapeName: (shape: any) => string;
  getMeasurementName: (feature: any, index: number) => string;
  getParcelName: (parcel: any) => string;

  onEditShape: (shapeId: string) => void;
  onDeleteShape: (shapeId: string) => void;

  onDeleteMeasurement: (feature: any, index: number) => void;

  onViewParcel: (parcel: any) => void;
  onDeleteParcel: (parcelId: any) => void;
};

export const ManagementSheet: React.FC<Props> = ({
  visible,
  onClose,
  insetsBottom,
  activeTab,
  setActiveTab,
  shapes,
  measurementFeatures,
  parcels,
  selectedShapeId,
  selectedParcelId,
  getShapeName,
  getMeasurementName,
  getParcelName,
  onEditShape,
  onDeleteShape,
  onDeleteMeasurement,
  onViewParcel,
  onDeleteParcel,
}) => {
  const measurementCount = (measurementFeatures || []).filter(
    (f: any) => !f?.properties?.isTemporary && !f?.properties?.isLabelOnly
  ).length;

  return (
    <AppBottomSheetModal
      visible={visible}
      onClose={onClose}
      snapPoints={["70%", "92%"]}
      initialIndex={0}
      backdropPressBehavior="close"
      backgroundStyle={{ backgroundColor: "#1e293b", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 4, borderTopColor: "#3b82f6" }}
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
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>Yönet</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Kapat">
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabNavigation}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "shapes" && styles.tabButtonActive]}
            onPress={() => setActiveTab("shapes")}
          >
            <Ionicons name="shapes" size={16} color={activeTab === "shapes" ? "#fff" : "#94a3b8"} />
            <Text style={[styles.tabButtonText, activeTab === "shapes" && styles.tabButtonTextActive]}>
              Şekiller ({(shapes || []).length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "measurements" && styles.tabButtonActive]}
            onPress={() => setActiveTab("measurements")}
          >
            <Ionicons name="resize" size={16} color={activeTab === "measurements" ? "#fff" : "#94a3b8"} />
            <Text style={[styles.tabButtonText, activeTab === "measurements" && styles.tabButtonTextActive]}>
              Ölçümler ({measurementCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "parcels" && styles.tabButtonActive]}
            onPress={() => setActiveTab("parcels")}
          >
            <Ionicons name="location" size={16} color={activeTab === "parcels" ? "#fff" : "#94a3b8"} />
            <Text style={[styles.tabButtonText, activeTab === "parcels" && styles.tabButtonTextActive]}>
              Parseller ({(parcels || []).length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <BottomSheetScrollView
          style={styles.tabContent}
          contentContainerStyle={[styles.tabContentContainer, { paddingBottom: Math.max(insetsBottom, 0) + 100 }]}
          showsVerticalScrollIndicator={true}
          scrollEventThrottle={16}
        >
          {/* Shapes Tab */}
          {activeTab === "shapes" && (
            <View style={styles.tabContentInner}>
              {(shapes || []).length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="shapes-outline" size={32} color="#64748b" />
                  <Text style={styles.emptyStateText}>Henüz şekil çizilmedi</Text>
                </View>
              ) : (
                (shapes || []).map((shape: any) => (
                  <View key={shape.id} style={styles.listItem}>
                    <View style={styles.listItemContent}>
                      <Ionicons
                        name={
                          shape.type === "rectangle"
                            ? "square-outline"
                            : shape.type === "triangle"
                              ? "triangle-outline"
                              : shape.type === "circle"
                                ? "ellipse-outline"
                                : shape.type === "ellipse"
                                  ? "ellipse"
                                  : shape.type === "polygon"
                                    ? "git-merge-outline"
                                    : shape.type === "line"
                                      ? "remove-outline"
                                      : shape.type === "arrow"
                                        ? "arrow-forward-outline"
                                        : shape.type === "marker"
                                          ? "location-outline"
                                          : "text-outline"
                        }
                        size={20}
                        color={selectedShapeId === shape.id ? "#3b82f6" : "#94a3b8"}
                      />
                      <Text style={[styles.listItemText, selectedShapeId === shape.id && styles.listItemTextActive]}>
                        {getShapeName(shape)}
                      </Text>
                    </View>
                    <View style={styles.listItemActions}>
                      <TouchableOpacity style={styles.listItemActionButton} onPress={() => onEditShape(shape.id)}>
                        <Ionicons name="create-outline" size={18} color="#3b82f6" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.listItemActionButton}
                        onPress={() => {
                          Alert.alert("Şekli Sil", `${getShapeName(shape)} silinsin mi?`, [
                            { text: "İptal", style: "cancel" },
                            { text: "Sil", style: "destructive", onPress: () => onDeleteShape(shape.id) },
                          ]);
                        }}
                      >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
              <View style={{ height: Math.max(insetsBottom, 0) + 150 }} />
            </View>
          )}

          {/* Measurements Tab */}
          {activeTab === "measurements" && (
            <View style={styles.tabContentInner}>
              {measurementCount === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="resize-outline" size={32} color="#64748b" />
                  <Text style={styles.emptyStateText}>Henüz ölçüm yapılmadı</Text>
                </View>
              ) : (
                (measurementFeatures || [])
                  .filter((f: any) => !f?.properties?.isTemporary && !f?.properties?.isLabelOnly)
                  .map((feature: any, index: number) => (
                    <TouchableOpacity
                      key={`meas-${index}`}
                      style={styles.listItem}
                      activeOpacity={0.85}
                      delayLongPress={320}
                      onLongPress={() => onDeleteMeasurement(feature, index)}
                    >
                      <View style={styles.listItemContent}>
                        <Ionicons
                          name={feature?.properties?.measurementType === "ruler" ? "resize" : "square"}
                          size={20}
                          color="#3b82f6"
                        />
                        <Text style={styles.listItemText}>{getMeasurementName(feature, index)}</Text>
                      </View>
                      <TouchableOpacity style={styles.listItemActionButton} onPress={() => onDeleteMeasurement(feature, index)}>
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))
              )}
              <View style={{ height: Math.max(insetsBottom, 0) + 150 }} />
            </View>
          )}

          {/* Parcels Tab */}
          {activeTab === "parcels" && (
            <View style={styles.tabContentInner}>
              {(parcels || []).length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="location-outline" size={32} color="#64748b" />
                  <Text style={styles.emptyStateText}>Henüz parsel seçilmedi</Text>
                </View>
              ) : (
                (parcels || []).map((parcel: any) => (
                  <View key={parcel.id} style={styles.listItem}>
                    <View style={styles.listItemContent}>
                      <Ionicons name="location" size={20} color={selectedParcelId === parcel.id ? "#3b82f6" : "#94a3b8"} />
                      <Text style={[styles.listItemText, selectedParcelId === parcel.id && styles.listItemTextActive]}>
                        {getParcelName(parcel)}
                      </Text>
                    </View>
                    <View style={styles.listItemActions}>
                      <TouchableOpacity style={styles.listItemActionButton} onPress={() => onViewParcel(parcel)}>
                        <Ionicons name="eye-outline" size={18} color="#3b82f6" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.listItemActionButton}
                        onPress={() => {
                          Alert.alert("Parseli Sil", `${getParcelName(parcel)} silinsin mi?`, [
                            { text: "İptal", style: "cancel" },
                            { text: "Sil", style: "destructive", onPress: () => onDeleteParcel(parcel.id) },
                          ]);
                        }}
                      >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
              <View style={{ height: Math.max(insetsBottom, 0) + 150 }} />
            </View>
          )}
        </BottomSheetScrollView>
      </View>
    </AppBottomSheetModal>
  );
};

