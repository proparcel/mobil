import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProParcelResponse, TkgmViewResponse, ParcelValues, TkgmProperties } from '../types/parcelResponse';
import { parseTurkishPrice, formatTurkishPrice } from '../utils/priceParser';

interface ParcelProperties {
  adaNo?: string;
  parselNo?: string;
  ada?: string;
  parsel?: string;
  mahalleAd?: string;
  ilceAd?: string;
  ilAd?: string;
  alan?: number;
  [key: string]: any; // Diğer property'ler için
}

interface ParcelModalProps {
  visible: boolean;
  onClose: () => void;
  properties?: ParcelProperties;
  analysisData?: ProParcelResponse | null; // Pro mod analiz verileri
}

export default function ParcelModal({
  visible,
  onClose,
  properties = {},
  analysisData,
}: ParcelModalProps) {
  // Properties'den bilgileri al, analysisData'dan da alabilir (fallback)
  const ada = properties.adaNo || properties.ada || properties.Ada || 
              (analysisData?.properties?.adaNo || analysisData?.properties?.ada) || '-';
  const parsel = properties.parselNo || properties.parsel || properties.Parsel || 
                 (analysisData?.properties?.parselNo || analysisData?.properties?.parsel) || '-';
  const mahalle = properties.mahalleAd || properties.mahalle || properties.quarterName || 
                  (analysisData?.properties?.mahalleAd || analysisData?.properties?.mahalle) || '-';
  const ilce = properties.ilceAd || properties.townName || properties.TownName || 
               (analysisData?.properties?.ilceAd || analysisData?.properties?.townName) || '-';
  const il = properties.ilAd || properties.cityName || properties.CityName || 
             (analysisData?.properties?.ilAd || analysisData?.properties?.cityName) || '-';
  const alan = properties.alan || properties.area || properties.Area || properties.Alan || 
               (analysisData?.properties?.alan || analysisData?.properties?.area) || null;
  
  // Pro mod analiz verilerinden fiyat bilgileri (0 dahil, veri yoksa 0)
  let birimFiyat: number = 0;
  let toplamFiyat: number = 0;
  let alanFromValues: string | number | null = null;
  
  if (analysisData) {
    const paramsData = analysisData.parameters_data || {};
    const parcelValues: ParcelValues = paramsData.parcel_values || {};
    
    // KM analizinden önerilen fiyatı da kontrol et
    const kmRecommendedPrice = paramsData.km_recommended_price;
    
    // Debug: analysisData yapısını kontrol et
    console.log('[ParcelModal] analysisData keys:', Object.keys(analysisData));
    console.log('[ParcelModal] parameters_data keys:', Object.keys(paramsData));
    console.log('[ParcelModal] parcelValues keys:', Object.keys(parcelValues));
    console.log('[ParcelModal] unite_price:', parcelValues.unite_price);
    console.log('[ParcelModal] quarter_uniteprice_km_estimated:', parcelValues.quarter_uniteprice_km_estimated);
    console.log('[ParcelModal] quarter_uniteprice:', parcelValues.quarter_uniteprice);
    console.log('[ParcelModal] km_recommended_price:', kmRecommendedPrice);
    
    // Alan bilgisini de parcelValues'dan alabilir
    alanFromValues = alan || parcelValues.alan || parcelValues.Area || parcelValues.area || parcelValues.Alan || null;
    
    // Birim fiyat (m²) - Backend'den gelen tüm olası key'leri kontrol et
    // Öncelik sırası: unite_price > quarter_uniteprice_km_estimated > km_recommended_price > quarter_uniteprice > diğerleri
    let rawBirimFiyat: string | number | null | undefined = null;
    
    // Önce unite_price'ı kontrol et (ana key)
    if (parcelValues.unite_price) {
      rawBirimFiyat = parcelValues.unite_price;
    } 
    // Sonra KM tahmini (daha güncel olabilir)
    else if (parcelValues.quarter_uniteprice_km_estimated) {
      rawBirimFiyat = parcelValues.quarter_uniteprice_km_estimated;
    }
    // Sonra km_recommended_price (parameters_data içinde)
    else if (kmRecommendedPrice) {
      rawBirimFiyat = kmRecommendedPrice;
    }
    // Sonra mahalle birim fiyatı
    else if (parcelValues.quarter_uniteprice) {
      rawBirimFiyat = parcelValues.quarter_uniteprice;
    }
    // Diğer alternatifler
    else {
      rawBirimFiyat = parcelValues.KYM_M2Price || 
                   parcelValues.M2Price || 
                   parcelValues.m2_price ||
                   parcelValues.m2Price ||
                   parcelValues.M2_Price ||
                   parcelValues.estimated_price || 
                   parcelValues.birim_fiyat ||
                   parcelValues.BirimFiyat ||
                   parcelValues.birimFiyat ||
                   parcelValues.unitPrice ||
                   parcelValues.unit_price ||
                   parcelValues.pricePerSquareMeter ||
                   parcelValues.price_per_square_meter ||
                   null;
    }
    
    // parseTurkishPrice utility fonksiyonu ile parse et
    birimFiyat = parseTurkishPrice(rawBirimFiyat);
    
    // Toplam fiyat - Backend'de price_of_tarla ana key (string formatında olabilir)
    let rawToplamFiyat: string | number | null | undefined = parcelValues.price_of_tarla ||  // Backend'de ana key
                  parcelValues.TotalPrice || 
                  parcelValues.total_price || 
                  parcelValues.toplam_fiyat ||
                  parcelValues.ToplamFiyat ||
                  parcelValues.totalPrice ||
                  parcelValues.estimatedTotalPrice ||
                  parcelValues.estimated_total_price ||
                  null;
    
    // parseTurkishPrice utility fonksiyonu ile parse et
    toplamFiyat = parseTurkishPrice(rawToplamFiyat);
    
    // Eğer toplam fiyat 0 ise ve birim fiyat + alan varsa hesapla
    if (toplamFiyat === 0 && alanFromValues && birimFiyat > 0) {
      const alanNum = typeof alanFromValues === 'string' 
        ? parseFloat(alanFromValues.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''))
        : alanFromValues;
      
      if (!isNaN(alanNum) && alanNum > 0 && birimFiyat > 0) {
        toplamFiyat = alanNum * birimFiyat;
      }
    }
    
    // Debug: Bulunan fiyatları logla
    console.log('[ParcelModal] rawBirimFiyat:', rawBirimFiyat, 'birimFiyat:', birimFiyat);
    console.log('[ParcelModal] rawToplamFiyat:', rawToplamFiyat, 'toplamFiyat:', toplamFiyat);
  }

  const displayAlan = alan || alanFromValues;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.titleRow}>
                <Ionicons name="location" size={20} color="#3b82f6" />
                <Text style={styles.modalTitle}>Parsel Bilgileri</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close-circle" size={28} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Pro Mod Fiyat Bilgileri - En üstte (her zaman göster) */}
            {analysisData && (
              <View style={styles.priceSection}>
                <View style={styles.priceSectionHeader}>
                  <Ionicons name="cash" size={20} color="#3b82f6" />
                  <Text style={styles.priceSectionTitle}>Tahmini Değer</Text>
                </View>
                
                {/* Birim Fiyat Kutusu - Her zaman göster */}
                <View style={styles.priceBox}>
                  <View style={styles.priceBoxHeader}>
                    <Ionicons name="calculator" size={16} color="#3b82f6" />
                    <Text style={styles.priceBoxLabel}>Birim Fiyat (m²)</Text>
                  </View>
                  <Text style={styles.priceBoxValue}>
                    {formatTurkishPrice(birimFiyat)}
                  </Text>
                </View>

                {/* Toplam Fiyat Kutusu - Her zaman göster */}
                <View style={[styles.priceBox, styles.totalPriceBox]}>
                  <View style={styles.priceBoxHeader}>
                    <Ionicons name="receipt" size={18} color="#10b981" />
                    <Text style={[styles.priceBoxLabel, styles.totalPriceBoxLabel]}>Toplam Fiyat</Text>
                  </View>
                  <Text style={styles.totalPriceBoxValue}>
                    {formatTurkishPrice(toplamFiyat)}
                  </Text>
                </View>
              </View>
            )}

            {/* Konum Bilgileri - Tek satırda */}
            {(mahalle !== '-' || ilce !== '-' || il !== '-') && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="map" size={18} color="#1e293b" />
                  <Text style={styles.cardTitle}>Konum</Text>
                </View>
                <View style={styles.locationRow}>
                  {il !== '-' && (
                    <>
                      <Text style={styles.locationText}>
                        <Text style={styles.locationLabel}>İl: </Text>
                        <Text style={styles.locationValue}>{il}</Text>
                      </Text>
                    </>
                  )}
                  {ilce !== '-' && (
                    <>
                      {il !== '-' && <Text style={styles.locationSeparator}> • </Text>}
                      <Text style={styles.locationText}>
                        <Text style={styles.locationLabel}>İlçe: </Text>
                        <Text style={styles.locationValue}>{ilce}</Text>
                      </Text>
                    </>
                  )}
                  {mahalle !== '-' && (
                    <>
                      {il !== '-' || ilce !== '-' ? <Text style={styles.locationSeparator}> • </Text> : null}
                      <Text style={styles.locationText}>
                        <Text style={styles.locationLabel}>Mahalle: </Text>
                        <Text style={styles.locationValue}>{mahalle}</Text>
                      </Text>
                    </>
                  )}
                </View>
              </View>
            )}

            {/* Ada Parsel ve Alan - Kompakt */}
            <View style={styles.adaParselCard}>
              <View style={styles.adaParselRow}>
                <View style={styles.adaParselItem}>
                  <Text style={styles.adaParselLabel}>Ada</Text>
                  <Text style={styles.adaParselValue}>{ada}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.adaParselItem}>
                  <Text style={styles.adaParselLabel}>Parsel</Text>
                  <Text style={styles.adaParselValue}>{parsel}</Text>
                </View>
              </View>
              
              {/* Alan bilgisi - Ada/Parsel'in altında */}
              {displayAlan && (
                <>
                  <View style={styles.alanDivider} />
                  <Text style={styles.alanValueInline}>
                    {typeof displayAlan === 'number' 
                      ? `${displayAlan.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`
                      : typeof displayAlan === 'string'
                        ? `${displayAlan} m²`
                        : `${String(displayAlan)} m²`
                    }
                  </Text>
                </>
              )}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.closeButtonFooter} onPress={onClose}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.closeButtonText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
    backgroundColor: '#f8fafc',
  },
  headerLeft: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  adaParselCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  adaParselRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 0,
  },
  adaParselItem: {
    flex: 1,
    alignItems: 'center',
  },
  adaParselLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 2,
    fontWeight: '500',
  },
  adaParselValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 12,
  },
  locationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingVertical: 4,
  },
  locationText: {
    fontSize: 14,
  },
  locationLabel: {
    color: '#6b7280',
    fontWeight: '500',
  },
  locationValue: {
    color: '#1e293b',
    fontWeight: '600',
  },
  locationSeparator: {
    color: '#cbd5e1',
    fontWeight: 'bold',
  },
  alanValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    paddingVertical: 2,
  },
  alanDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginTop: 6,
    marginBottom: 6,
    marginHorizontal: 8,
  },
  alanValueInline: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    textAlign: 'center',
    paddingVertical: 2,
  },
  priceSection: {
    marginTop: 4,
    marginBottom: 4,
  },
  priceSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  priceSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  priceBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  priceBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  priceBoxLabel: {
    fontSize: 13,
    color: '#1e40af',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceBoxValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#3b82f6',
    textAlign: 'center',
  },
  totalPriceBox: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
    marginTop: 0,
  },
  totalPriceBoxLabel: {
    color: '#047857',
    fontSize: 14,
  },
  totalPriceBoxValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#10b981',
    textAlign: 'center',
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 60, // Telefon footer'ı için ekstra boşluk (artırıldı)
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#f8fafc',
  },
  closeButtonFooter: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
