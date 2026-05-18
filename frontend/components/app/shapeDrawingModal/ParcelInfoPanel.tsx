import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { styles } from "./styles";

type Props = {
  selectedParcel: any;
  visible: boolean;
  bottomInset: number;
  onClose: () => void;
};

export const ParcelInfoPanel: React.FC<Props> = ({ selectedParcel, visible, bottomInset, onClose }) => {
  if (!visible || !selectedParcel) return null;

  return (
    <View style={[styles.parcelInfoPanel, { bottom: bottomInset + 20 }]}>
      <View style={styles.parcelInfoHeader}>
        <Ionicons name="location" size={16} color="#3b82f6" />
        <Text style={styles.parcelInfoTitle}>Seçili Parsel</Text>
        <TouchableOpacity onPress={onClose} style={styles.parcelInfoCloseButton}>
          <Ionicons name="close" size={16} color="#94a3b8" />
        </TouchableOpacity>
      </View>
      {selectedParcel?.properties && (
        <View style={styles.parcelInfoContent}>
          {selectedParcel.properties.mahalleAd && (
            <Text style={styles.parcelInfoText}>
              <Text style={styles.parcelInfoLabel}>Mahalle: </Text>
              {selectedParcel.properties.mahalleAd}
            </Text>
          )}
          {selectedParcel.properties.adaNo && (
            <Text style={styles.parcelInfoText}>
              <Text style={styles.parcelInfoLabel}>Ada: </Text>
              {selectedParcel.properties.adaNo}
            </Text>
          )}
          {selectedParcel.properties.parselNo && (
            <Text style={styles.parcelInfoText}>
              <Text style={styles.parcelInfoLabel}>Parsel: </Text>
              {selectedParcel.properties.parselNo}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

