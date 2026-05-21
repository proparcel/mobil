import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { KeyboardAwareModal } from './KeyboardAwareModal';

interface TextBoxEditModalProps {
  visible: boolean;
  initialText: string;
  onCancel: () => void;
  onSave: (nextText: string) => void;
}

export const TextBoxEditModal: React.FC<TextBoxEditModalProps> = ({
  visible,
  initialText,
  onCancel,
  onSave,
}) => {
  const [value, setValue] = useState(initialText ?? '');

  useEffect(() => {
    if (visible) setValue(initialText ?? '');
  }, [visible, initialText]);

  return (
    <KeyboardAwareModal visible={visible} animationType="fade" onRequestClose={onCancel} backdropStyle={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Metni Düzenle</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="Metin"
            placeholderTextColor="#64748b"
            style={styles.input}
            multiline
          />
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onCancel}>
              <Text style={styles.btnText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => onSave(value)}>
              <Text style={styles.btnText}>Kaydet</Text>
            </TouchableOpacity>
          </View>
        </View>
    </KeyboardAwareModal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  input: {
    minHeight: 90,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnGhost: {
    borderColor: '#334155',
    backgroundColor: 'transparent',
  },
  btnPrimary: {
    borderColor: '#2563eb',
    backgroundColor: '#2563eb',
  },
  btnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});

