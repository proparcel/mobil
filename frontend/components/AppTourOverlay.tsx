import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const AppTourOverlay: React.FC<Props> = ({ visible, onClose }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>Hızlı tur</Text>
        <Text style={styles.text}>Üst menüden vitrin ve sorgulara ulaşın; alttaki araç çubuğu ile harita araçlarını kullanın.</Text>
        <TouchableOpacity style={styles.btn} onPress={onClose}>
          <Text style={styles.btnText}>Tamam</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

export default AppTourOverlay;

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 22 },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  text: { fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: 20 },
  btn: { backgroundColor: '#3b82f6', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});
