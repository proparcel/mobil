import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  onShare: () => Promise<void>;
  isProcessing?: boolean;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.4;

const ShareModal: React.FC<ShareModalProps> = ({ visible, onClose, onShare, isProcessing = false }) => {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(SCREEN_HEIGHT);

  React.useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, {
        duration: 350,
        easing: Easing.out(Easing.exp),
      });
    } else {
      translateY.value = withTiming(SCREEN_HEIGHT, {
        duration: 250,
        easing: Easing.in(Easing.exp),
      });
    }
  }, [visible]);

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > 150 || event.velocityY > 500) {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 }, () => {
          runOnJS(onClose)();
        });
      } else {
        translateY.value = withTiming(0, {
          duration: 250,
          easing: Easing.out(Easing.exp),
        });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleShare = async () => {
    try {
      await onShare();
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.dismissArea}
            activeOpacity={1}
            onPress={onClose}
            disabled={isProcessing}
          />
          <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.modalContent, animatedStyle, { 
              height: MODAL_HEIGHT + Math.max(insets.bottom || 0, 20),
              paddingBottom: Math.max(insets.bottom || 0, 20) 
            }]}>
              <View style={styles.grabber} />
              
              <View style={styles.content}>
                <TouchableOpacity
                  style={styles.iconContainer}
                  onPress={handleShare}
                  disabled={isProcessing}
                  activeOpacity={0.7}
                >
                  <Ionicons name="share-outline" size={48} color="#3b82f6" />
                </TouchableOpacity>
                
                <Text style={styles.title}>Ekran Görüntüsünü Paylaş</Text>
                <Text style={styles.description}>
                  Harita ve parsel bilgilerini içeren görüntüyü paylaşmak ister misiniz?
                </Text>

                {isProcessing && (
                  <View style={styles.processingContainer}>
                    <ActivityIndicator size="small" color="#3b82f6" />
                    <Text style={styles.processingText}>Görüntü hazırlanıyor...</Text>
                  </View>
                )}

                <View style={[styles.buttonContainer, { marginBottom: Math.max(insets.bottom || 0, 20) }]}>
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={onClose}
                    disabled={isProcessing}
                  >
                    <Text style={styles.cancelButtonText}>İptal</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.button, styles.shareButton, isProcessing && styles.shareButtonDisabled]}
                    onPress={handleShare}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="share" size={20} color="#fff" style={styles.shareIcon} />
                        <Text style={styles.shareButtonText}>Paylaş</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    minHeight: MODAL_HEIGHT,
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    marginBottom: 8,
  },
  content: {
    padding: 24,
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  processingText: {
    fontSize: 14,
    color: '#64748b',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
  shareButton: {
    backgroundColor: '#3b82f6',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  shareButtonDisabled: {
    opacity: 0.6,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  shareIcon: {
    marginRight: 8,
  },
});

export default ShareModal;
