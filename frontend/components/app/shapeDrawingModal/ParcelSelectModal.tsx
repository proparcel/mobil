import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AdaParselForm from '../../AdaParselForm';

interface ParcelSelectModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectByClick: () => void;
  onSelectByAdaParsel: (payload: {
    mahalleTkgmValue: number;
    mahalle: string;
    ada: string;
    parsel: string;
    proparcelValue?: number;
    city?: string;
    town?: string;
  }) => void;
  apiUrl: string;
}

export const ParcelSelectModal: React.FC<ParcelSelectModalProps> = ({
  visible,
  onClose,
  onSelectByClick,
  onSelectByAdaParsel,
  apiUrl,
}) => {
  const [selectMethod, setSelectMethod] = useState<'ada-parsel' | 'click'>('ada-parsel');
  const [showAdaParselForm, setShowAdaParselForm] = useState(false);

  const handleMethodSelect = (method: 'ada-parsel' | 'click') => {
    setSelectMethod(method);
    if (method === 'click') {
      // Haritadan tıklama modunu aktif et
      onSelectByClick();
      onClose();
    } else {
      // Ada/Parsel formunu göster
      setShowAdaParselForm(true);
    }
  };

  const handleAdaParselSubmit = (payload: {
    mahalleTkgmValue: number;
    mahalle: string;
    ada: string;
    parsel: string;
    proparcelValue?: number;
    city?: string;
    town?: string;
  }) => {
    onSelectByAdaParsel(payload);
    setShowAdaParselForm(false);
    onClose();
  };

  const handleClose = () => {
    setShowAdaParselForm(false);
    setSelectMethod('ada-parsel');
    onClose();
  };

  if (showAdaParselForm) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="arrow-back" size={24} color="#1f2937" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Ada/Parsel Sorgula</Text>
            <View style={styles.closeButton} />
          </View>
          <AdaParselForm
            onClose={handleClose}
            onSubmit={handleAdaParselSubmit}
          />
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Parsel Seç</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <Text style={styles.description}>
            Parsel seçmek için bir yöntem seçin:
          </Text>

          {/* Ada/Parsel Seçeneği */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              selectMethod === 'ada-parsel' && styles.optionCardActive,
            ]}
            onPress={() => handleMethodSelect('ada-parsel')}
            activeOpacity={0.7}
          >
            <View style={styles.optionIconContainer}>
              <Ionicons
                name="search"
                size={24}
                color={selectMethod === 'ada-parsel' ? '#1e40af' : '#64748b'}
              />
            </View>
            <View style={styles.optionContent}>
              <Text
                style={[
                  styles.optionTitle,
                  selectMethod === 'ada-parsel' && styles.optionTitleActive,
                ]}
              >
                Ada/Parsel
              </Text>
              <Text style={styles.optionDescription}>
                İl, İlçe, Mahalle, Ada ve Parsel bilgileri ile sorgula
              </Text>
            </View>
            {selectMethod === 'ada-parsel' && (
              <Ionicons name="checkmark-circle" size={24} color="#1e40af" />
            )}
          </TouchableOpacity>

          {/* Haritadan Tıkla Seçeneği */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              selectMethod === 'click' && styles.optionCardActive,
            ]}
            onPress={() => handleMethodSelect('click')}
            activeOpacity={0.7}
          >
            <View style={styles.optionIconContainer}>
              <Ionicons
                name="location"
                size={24}
                color={selectMethod === 'click' ? '#1e40af' : '#64748b'}
              />
            </View>
            <View style={styles.optionContent}>
              <Text
                style={[
                  styles.optionTitle,
                  selectMethod === 'click' && styles.optionTitleActive,
                ]}
              >
                Haritadan Tıkla
              </Text>
              <Text style={styles.optionDescription}>
                Haritada bir yere tıklayarak parsel seç
              </Text>
            </View>
            {selectMethod === 'click' && (
              <Ionicons name="checkmark-circle" size={24} color="#1e40af" />
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  description: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  optionCardActive: {
    borderColor: '#1e40af',
    backgroundColor: '#eff6ff',
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  optionTitleActive: {
    color: '#1e40af',
  },
  optionDescription: {
    fontSize: 14,
    color: '#64748b',
  },
});
