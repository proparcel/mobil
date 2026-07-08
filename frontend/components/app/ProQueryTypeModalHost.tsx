/**
 * Tip seçimi ile Pro Sorgu akışının modallarını mount eden host bileşeni.
 *
 * `useProQueryAfterTypeSelect` controller'ını alır ve tip seçim modalı + alt modallar
 * (Villa/Fabrika/Bina/Müstakil/Konut) + yükleme overlay'ini render eder. Böylece ekran
 * dosyaları (ör. son-30-gun-detay) minimal kalır.
 */

import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import PropertyTypeSelectionModal from '../PropertyTypeSelectionModal';
import VillaEstimateModal from '../VillaEstimateModal';
import FactoryEstimateModal from '../FactoryEstimateModal';
import BinaEstimateModal from '../BinaEstimateModal';
import MustakilEvEstimateModal from '../MustakilEvEstimateModal';
import KonutDaireModal from '../KonutDaireModal';
import ProQueryApifyPendingModal from './ProQueryApifyPendingModal';
import type { ProQueryTypeFlowController } from '../../src/hooks/useProQueryAfterTypeSelect';

type Props = {
  controller: ProQueryTypeFlowController;
};

const ProQueryTypeModalHost: React.FC<Props> = ({ controller: c }) => {
  return (
    <>
      <PropertyTypeSelectionModal
        visible={c.typeModalVisible}
        onClose={c.closeTypeModal}
        onSelect={c.handleSelect}
        title={c.typeModalTitle}
        suggestedType={c.typeModalSuggested}
      />
      <VillaEstimateModal
        visible={c.villaVisible}
        onClose={() => c.onVillaResult(null)}
        onResult={c.onVillaResult}
        areaM2={c.areaM2}
      />
      <FactoryEstimateModal
        visible={c.factoryVisible}
        onClose={() => c.onFactoryResult(null)}
        onResult={c.onFactoryResult}
        areaM2={c.areaM2}
        location={{}}
      />
      <BinaEstimateModal
        visible={c.binaVisible}
        onClose={() => c.onBinaResult(null)}
        onResult={c.onBinaResult}
        areaM2={c.areaM2}
      />
      <MustakilEvEstimateModal
        visible={c.mustakilVisible}
        onClose={() => c.onMustakilResult(null)}
        onResult={c.onMustakilResult}
        areaM2={c.areaM2}
      />
      <KonutDaireModal
        visible={c.konutVisible}
        onClose={() => c.onKonutResult(null)}
        onResult={c.onKonutResult}
      />
      <ProQueryApifyPendingModal
        visible={c.apifyPendingVisible}
        message={c.apifyPendingMessage}
        confirming={c.apifyConfirming}
        onConfirm={c.confirmApifyPending}
        onCancel={c.dismissApifyPending}
      />
      <Modal visible={c.submitting} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.text}>Pro Sorgu çalıştırılıyor…</Text>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 12,
    minWidth: 220,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
});

export default ProQueryTypeModalHost;
