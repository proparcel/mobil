import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import locationsDataRaw from '../data/locations.json';

// Conditional import for expo-image-picker (native module)
// This will be null if native module is not available (e.g., in Expo Go without native build)
// COMMENTED OUT: Image picker temporarily disabled
/*
let ImagePicker: any = null;
try {
  const imagePickerModule = require('expo-image-picker');
  if (imagePickerModule && typeof imagePickerModule === 'object') {
    ImagePicker = imagePickerModule.default || imagePickerModule;
  }
} catch (e) {
  // Module not available - will be handled in the code that uses it
  ImagePicker = null;
}
*/
let ImagePicker: any = null;

interface AdaParselFormProps {
  onClose: () => void;
  isProMode?: boolean;
  onParcelDataReceived?: (data: any) => void;
}

interface City {
  Id: number;
  Proparcel_text: string;
  Tkgm_value: number;
  CityPlaka: number;
  Towns: Town[];
}

interface Town {
  Id: number;
  Proparcel_text: string;
  Tkgm_value: number;
  Quarters: Quarter[];
}

interface Quarter {
  Id: number;
  Tkgm_text: string;
  Tkgm_value: number;
  Proparcel_text: string;
  Proparcel_value: string | number;
  Inactive: boolean;
}

interface LocationsData {
  cities: City[];
}

// Type assertion for JSON import
const locationsData = locationsDataRaw as LocationsData;

const AdaParselForm: React.FC<AdaParselFormProps> = ({ onClose, isProMode = false, onParcelDataReceived }) => {
  const [activeTab, setActiveTab] = useState<'parsel' | 'akilli'>('parsel');
  
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [selectedTownId, setSelectedTownId] = useState<number | null>(null);
  const [selectedQuarterId, setSelectedQuarterId] = useState<number | null>(null);
  const [selectedProparcelValue, setSelectedProparcelValue] = useState<string | number | null>(null);
  
  const [ada, setAda] = useState('');
  const [parsel, setParsel] = useState('');
  
  // Akıllı Sorgu state'leri
  const [akilliSorguText, setAkilliSorguText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  // COMMENTED OUT: Image picker temporarily disabled
  // const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  
  const [showIlPicker, setShowIlPicker] = useState(false);
  const [showIlcePicker, setShowIlcePicker] = useState(false);
  const [showMahallePicker, setShowMahallePicker] = useState(false);
  
  // Arama state'leri
  const [ilSearchText, setIlSearchText] = useState('');
  const [ilceSearchText, setIlceSearchText] = useState('');
  const [mahalleSearchText, setMahalleSearchText] = useState('');

  // İl, ilçe, mahalle isimlerini hesapla
  const selectedCity = useMemo(() => {
    if (!selectedCityId) return null;
    return (locationsData.cities as City[]).find(c => c.Id === selectedCityId);
  }, [selectedCityId]);

  const selectedTown = useMemo(() => {
    if (!selectedCity || !selectedTownId) return null;
    return selectedCity.Towns.find(t => t.Id === selectedTownId);
  }, [selectedCity, selectedTownId]);

  const selectedQuarter = useMemo(() => {
    if (!selectedTown || !selectedQuarterId) return null;
    return selectedTown.Quarters.find(q => q.Id === selectedQuarterId);
  }, [selectedTown, selectedQuarterId]);

  // Seçili ilçeleri getir
  const availableTowns = useMemo(() => {
    if (!selectedCity) return [];
    return selectedCity.Towns.filter(town => 
      town.Quarters && town.Quarters.length > 0
    );
  }, [selectedCity]);

  // Seçili mahalleleri getir (Inactive olmayanlar)
  const availableQuarters = useMemo(() => {
    if (!selectedTown) return [];
    return selectedTown.Quarters.filter(quarter => !quarter.Inactive);
  }, [selectedTown]);

  // Türkçe karakter normalize fonksiyonu
  const normalizeTr = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c');
  };

  // Filtrelenmiş listeler
  const filteredCities = useMemo(() => {
    if (!ilSearchText.trim()) return locationsData.cities as City[];
    const search = normalizeTr(ilSearchText);
    return (locationsData.cities as City[]).filter(city =>
      normalizeTr(city.Proparcel_text).includes(search)
    );
  }, [ilSearchText]);

  const filteredTowns = useMemo(() => {
    if (!ilceSearchText.trim()) return availableTowns;
    const search = normalizeTr(ilceSearchText);
    return availableTowns.filter(town =>
      normalizeTr(town.Proparcel_text).includes(search)
    );
  }, [availableTowns, ilceSearchText]);

  const filteredQuarters = useMemo(() => {
    if (!mahalleSearchText.trim()) return availableQuarters;
    const search = normalizeTr(mahalleSearchText);
    return availableQuarters.filter(quarter => {
      const tkgmMatch = normalizeTr(quarter.Tkgm_text).includes(search);
      const proparcelMatch = quarter.Proparcel_text 
        ? normalizeTr(quarter.Proparcel_text).includes(search)
        : false;
      return tkgmMatch || proparcelMatch;
    });
  }, [availableQuarters, mahalleSearchText]);

  const handleIlSelect = (city: City) => {
    setSelectedCityId(city.Id);
    setSelectedTownId(null);
    setSelectedQuarterId(null);
    setSelectedProparcelValue(null);
    setIlSearchText('');
    setShowIlPicker(false);
  };

  const handleIlceSelect = (town: Town) => {
    setSelectedTownId(town.Id);
    setSelectedQuarterId(null);
    setSelectedProparcelValue(null);
    setIlceSearchText('');
    setShowIlcePicker(false);
  };

  const handleMahalleSelect = (quarter: Quarter) => {
    setSelectedQuarterId(quarter.Id);
    setSelectedProparcelValue(quarter.Proparcel_value);
    setMahalleSearchText('');
    setShowMahallePicker(false);
  };

  const handleSorgula = async () => {
    if (!selectedCity || !selectedTown || !selectedQuarter || !ada || !parsel) {
      Alert.alert('Eksik Bilgi', 'Lütfen tüm alanları doldurun');
      return;
    }

    if (!selectedProparcelValue) {
      Alert.alert('Hata', 'Mahalle Proparcel değeri bulunamadı.');
      return;
    }
    
    // Sorgu verileri (Proparcel_value dahil)
    const queryData = {
      city: selectedCity.Proparcel_text,
      cityId: selectedCity.Id,
      town: selectedTown.Proparcel_text,
      townId: selectedTown.Id,
      quarter: selectedQuarter.Proparcel_text,
      quarterId: selectedQuarter.Id,
      proparcelValue: selectedProparcelValue,
      ada: ada,
      parsel: parsel,
    };
    
    // Parent component'e veriyi gönder (parent haritaya çizecek)
    if (onParcelDataReceived) {
      onParcelDataReceived(queryData);
    }
    
    // TODO: API'ye sorgu gönder
    console.log('Sorgu verisi:', queryData);
  };

  const handleTemizle = () => {
    setSelectedCityId(null);
    setSelectedTownId(null);
    setSelectedQuarterId(null);
    setSelectedProparcelValue(null);
    setAda('');
    setParsel('');
  };

  // Sadece rakam girişine izin veren fonksiyon
  const handleNumericInput = (text: string, setter: (value: string) => void) => {
    const numericText = text.replace(/[^0-9]/g, '');
    setter(numericText);
  };

  // Ses kaydı başlat
  const startRecording = async () => {
    // Eğer zaten kayıt yapılıyorsa, önce durdur
    if (isRecording && recording) {
      Alert.alert('Bilgi', 'Lütfen önce mevcut kaydı durdurun.');
      return;
    }

    try {
      const logStart = `[${new Date().toLocaleTimeString()}] Kayıt başlatma işlemi başladı`;
      setDebugLogs(prev => [...prev.slice(-9), logStart]);

      // ÖNEMLİ: İlk olarak audio modunu kesinlikle sıfırla
      // Bu, native modüldeki herhangi bir kayıt objesini temizler
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: false,
        });
        // Native modülün tamamen sıfırlanması için bekleme
        await new Promise(resolve => setTimeout(resolve, 400));
        const logReset = `[${new Date().toLocaleTimeString()}] Audio mode sıfırlandı`;
        setDebugLogs(prev => [...prev.slice(-9), logReset]);
      } catch (audioModeErr: any) {
        const logErr = `[${new Date().toLocaleTimeString()}] Audio mode sıfırlanırken hata: ${audioModeErr.message}`;
        setDebugLogs(prev => [...prev.slice(-9), logErr]);
      }

      // Eğer state'de bir kayıt objesi varsa, onu da temizle
      if (recording) {
        try {
          const status: any = await recording.getStatusAsync();
          if (status.isLoaded) {
            if (!status.isDoneRecording) {
              await recording.stopAndUnloadAsync();
            }
            // Her durumda unload et
            try {
              if ('unloadAsync' in recording && typeof (recording as any).unloadAsync === 'function') {
                await (recording as any).unloadAsync();
              }
            } catch (unloadErr) {
              // Zaten unload edilmiş olabilir, normal
            }
          }
        } catch (cleanupErr: any) {
          // Kayıt objesi zaten geçersiz olabilir, normal
          const logCleanup = `[${new Date().toLocaleTimeString()}] Önceki kayıt temizlenirken hata (normal olabilir): ${cleanupErr.message}`;
          setDebugLogs(prev => [...prev.slice(-9), logCleanup]);
        }
        setRecording(null);
        setIsRecording(false);
        // Native modülün tamamen temizlenmesi için yeterli bekleme
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Ses kaydı izni iste
      const permissionResponse = await Audio.requestPermissionsAsync();
      if (permissionResponse.status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Ses kaydı için mikrofon izni gerekli.');
        return;
      }

      // Audio modunu kayıt için ayarla
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Audio mode'un uygulanması için bekleme
      await new Promise(resolve => setTimeout(resolve, 300));

      const logBeforeCreate = `[${new Date().toLocaleTimeString()}] Recording.createAsync çağrılıyor...`;
      setDebugLogs(prev => [...prev.slice(-9), logBeforeCreate]);

      // Yeni kayıt başlat
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      setIsRecording(true);
      
      const logMsg = `[${new Date().toLocaleTimeString()}] Yeni kayıt başarıyla başlatıldı`;
      console.log(logMsg);
      setDebugLogs(prev => [...prev.slice(-9), logMsg]);
    } catch (err: any) {
      const errorMsg = `[${new Date().toLocaleTimeString()}] Ses kaydı başlatma hatası: ${err.message || 'Bilinmeyen hata'}`;
      console.error(errorMsg);
      setDebugLogs(prev => [...prev.slice(-9), errorMsg]);
      
      // Hata durumunda state'i temizle
      setIsRecording(false);
      setRecording(null);
      
      // Audio modunu tekrar sıfırla
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: false,
        });
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (resetErr: any) {
        console.log('Audio mode sıfırlanırken hata:', resetErr.message);
      }
      
      // Kullanıcıya bilgi ver
      if (err.message && err.message.includes('Only one Recording')) {
        Alert.alert(
          'Hata', 
          'Kayıt başlatılamadı. Lütfen birkaç saniye bekleyip tekrar deneyin. Eğer sorun devam ederse uygulamayı yeniden başlatın.'
        );
      } else {
        Alert.alert('Hata', `Ses kaydı başlatılamadı: ${err.message || 'Bilinmeyen hata'}`);
      }
    }
  };

  // Ses kaydı durdur ve işle
  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      console.log('Kayıt durduruluyor...');
      
      // URI'yi kaydet çünkü unload edildikten sonra erişilemez
      const uri = recording.getURI();
      
      // Recording durumunu kontrol et ve güvenli şekilde durdur
      let recordingStopped = false;
      try {
        const status: any = await recording.getStatusAsync();
        if (status.isLoaded && !status.isDoneRecording) {
          await recording.stopAndUnloadAsync();
          recordingStopped = true;
          console.log('Kayıt başarıyla durduruldu ve unload edildi');
        } else if (status.isLoaded && status.isDoneRecording) {
          // Zaten durdurulmuş, sadece unload et
          if ('unloadAsync' in recording && typeof (recording as any).unloadAsync === 'function') {
            await (recording as any).unloadAsync();
          }
          recordingStopped = true;
          console.log('Kayıt zaten durdurulmuş, unload edildi');
        }
      } catch (stopErr: any) {
        console.log('Kayıt durdurulurken hata (normal olabilir):', stopErr);
        // Hata olsa bile devam et
      }
      
      // State'i temizle
      const currentRecording = recording;
      setRecording(null);
      
      // Audio modunu sıfırla
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: false,
        });
      } catch (audioModeErr) {
        console.log('Audio mode sıfırlanırken hata:', audioModeErr);
      }

      if (!uri) {
        Alert.alert('Hata', 'Ses kaydı alınamadı.');
        return;
      }

      // Native modülün tamamen temizlenmesi için kısa bir bekleme
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Ses dosyasını işle
      await processAudioRecording(uri);
    } catch (err: any) {
      console.error('Ses kaydı durdurma hatası:', err);
      Alert.alert('Hata', `Ses kaydı durdurulamadı: ${err.message || 'Bilinmeyen hata'}`);
      setIsRecording(false);
      setRecording(null);
      
      // Hata durumunda da audio modunu sıfırla
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: false,
        });
      } catch (resetErr) {
        console.log('Audio mode sıfırlanırken hata:', resetErr);
      }
    }
  };

  // Ses kaydını işle ve metne çevir
  const processAudioRecording = async (uri: string) => {
    try {
      setIsProcessingAudio(true);
      const logMsg = `[${new Date().toLocaleTimeString()}] Ses dosyası işleniyor: ${uri}`;
      console.log(logMsg);
      setDebugLogs(prev => [...prev.slice(-9), logMsg]); // Son 10 log'u tut
      
      // Platform'a göre MIME type belirle
      const mimeType = Platform.OS === 'ios' ? 'audio/m4a' : 'audio/mp4';
      
      // Ses dosyasını base64'e çevir (legacy expo-file-system API kullanarak)
      let base64Audio: string;
      try {
        base64Audio = await FileSystemLegacy.readAsStringAsync(uri, {
          encoding: 'base64' as any,
        });
        const logMsg2 = `[${new Date().toLocaleTimeString()}] Base64 dönüşümü tamamlandı, boyut: ${base64Audio.length}`;
        console.log(logMsg2);
        setDebugLogs(prev => [...prev.slice(-9), logMsg2]);
      } catch (fileErr: any) {
        const errorMsg = `[${new Date().toLocaleTimeString()}] Dosya okuma hatası: ${fileErr.message || 'Bilinmeyen hata'}`;
        console.error(errorMsg);
        setDebugLogs(prev => [...prev.slice(-9), errorMsg]);
        Alert.alert('Hata', 'Ses dosyası okunamadı. Lütfen tekrar deneyin.');
        setIsProcessingAudio(false);
        return;
      }

      // FastAPI backend'e gönder (FastAPI 8001, Django 8000)
      // TODO: Environment variable'dan backend URL'ini al
      const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.101:8001';
      const logMsg3 = `[${new Date().toLocaleTimeString()}] Backend URL: ${backendUrl}`;
      console.log(logMsg3);
      setDebugLogs(prev => [...prev.slice(-9), logMsg3]);
      
      const logMsgFetchStart = `[${new Date().toLocaleTimeString()}] Backend'e istek gönderiliyor...`;
      console.log(logMsgFetchStart);
      setDebugLogs(prev => [...prev.slice(-9), logMsgFetchStart]);
      
      let speechResponse: Response;
      try {
        // Timeout kontrolü ile fetch (30 saniye)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          const timeoutMsg = `[${new Date().toLocaleTimeString()}] ⚠️ TIMEOUT: 30 saniye içinde yanıt alınamadı`;
          console.error(timeoutMsg);
          setDebugLogs(prev => [...prev.slice(-9), timeoutMsg]);
        }, 30000);
        
        const fetchStartTime = Date.now();
        speechResponse = await fetch(`${backendUrl}/api/speech-to-text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audio: base64Audio,
            mimeType: mimeType,
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        const fetchDuration = Date.now() - fetchStartTime;
        const logMsgFetchDone = `[${new Date().toLocaleTimeString()}] ✅ Backend yanıtı alındı (${(fetchDuration / 1000).toFixed(2)}s)`;
        console.log(logMsgFetchDone);
        setDebugLogs(prev => [...prev.slice(-9), logMsgFetchDone]);
        
      } catch (fetchErr: any) {
        const errorMsg = `[${new Date().toLocaleTimeString()}] ❌ Fetch hatası: ${fetchErr.message || 'Bilinmeyen hata'}`;
        console.error(errorMsg);
        setDebugLogs(prev => [...prev.slice(-9), errorMsg]);
        
        let errorDetail = fetchErr.message || 'Bilinmeyen hata';
        if (fetchErr.name === 'AbortError') {
          errorDetail = 'Timeout: İstek 30 saniye içinde yanıt vermedi. Backend çalışıyor mu?';
        } else if (fetchErr.message?.includes('Network request failed')) {
          errorDetail = 'Ağ hatası: Backend\'e bağlanılamadı. Backend\'in çalıştığından ve aynı ağda olduğunuzdan emin olun.';
        }
        
        Alert.alert(
          'Bağlantı Hatası', 
          `${errorDetail}\n\nBackend URL: ${backendUrl}\n\nLütfen backend'in çalıştığından emin olun.`
        );
        setIsProcessingAudio(false);
        return;
      }

      const logMsgStatus = `[${new Date().toLocaleTimeString()}] Response status: ${speechResponse.status}`;
      console.log(logMsgStatus);
      setDebugLogs(prev => [...prev.slice(-9), logMsgStatus]);

      if (!speechResponse.ok) {
        const errorText = await speechResponse.text();
        const errorMsg2 = `[${new Date().toLocaleTimeString()}] ❌ API hatası (${speechResponse.status}): ${errorText.substring(0, 200)}`;
        console.error(errorMsg2);
        setDebugLogs(prev => [...prev.slice(-9), errorMsg2]);
        
        // Billing hatası kontrolü
        let alertTitle = 'API Hatası';
        let alertMessage = `Speech-to-Text API hatası (${speechResponse.status}): ${errorText.substring(0, 300) || 'Bilinmeyen hata'}`;
        
        if (speechResponse.status === 402 || errorText.toLowerCase().includes('billing') || errorText.includes('BILLING_DISABLED')) {
          alertTitle = 'Billing Gerekli';
          alertMessage = 'Google Cloud Speech-to-Text API kullanmak için billing (faturalandırma) aktif olmalı.\n\n' +
                        'Lütfen Google Cloud Console\'da billing\'i aktif edin:\n' +
                        'https://console.developers.google.com/billing/enable?project=1091364358970\n\n' +
                        'Billing aktif ettikten sonra birkaç dakika bekleyip tekrar deneyin.';
        }
        
        Alert.alert(alertTitle, alertMessage);
        setIsProcessingAudio(false);
        return;
      }

      const parseStartTime = Date.now();
      const speechData = await speechResponse.json();
      const parseDuration = Date.now() - parseStartTime;
      
      const logMsg4 = `[${new Date().toLocaleTimeString()}] JSON parse tamamlandı (${parseDuration}ms), yanıt: ${JSON.stringify(speechData).substring(0, 100)}...`;
      console.log(logMsg4);
      setDebugLogs(prev => [...prev.slice(-9), logMsg4]);
      const transcribedText = speechData.text;

      if (!transcribedText || !transcribedText.trim()) {
        Alert.alert('Uyarı', 'Ses kaydından metin çıkarılamadı. Lütfen daha net konuşup tekrar deneyin.');
        setIsProcessingAudio(false);
        return;
      }

      const logMsg5 = `[${new Date().toLocaleTimeString()}] Transkripsiyon başarılı: ${transcribedText}`;
      console.log(logMsg5);
      setDebugLogs(prev => [...prev.slice(-9), logMsg5]);
      // Metni input alanına yaz (transkripsiyon)
      setAkilliSorguText(transcribedText);

      // Metni text query extract'e gönder ve çıkarılan bilgileri de input'a ekle
      await processTextQuery(transcribedText, true);
      
    } catch (err: any) {
      const errorMsg2 = `[${new Date().toLocaleTimeString()}] Ses işleme hatası: ${err.message || 'Bilinmeyen hata'}`;
      console.error(errorMsg2);
      setDebugLogs(prev => [...prev.slice(-9), errorMsg2]);
      Alert.alert(
        'Hata', 
        `Ses kaydı işlenirken bir hata oluştu: ${err.message || 'Bilinmeyen hata'}`
      );
    } finally {
      setIsProcessingAudio(false);
    }
  };

  // Metin sorgu extract işle
  const processTextQuery = async (text: string, appendExtractedInfo: boolean = false) => {
    try {
      if (!appendExtractedInfo) {
        setIsProcessingAudio(true);
      }

      // FastAPI backend'e gönder (FastAPI 8001, Django 8000)
      // TODO: Environment variable'dan backend URL'ini al
      const backendUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.101:8001';
      const response = await fetch(`${backendUrl}/api/text-query-extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('Text Query Extract API hatası');
      }

      const data = await response.json();

      if (data.ok && data.il && data.ilce) {
        // Çıkarılan bilgileri formatla
        const extractedParts: string[] = [];
        if (data.il) extractedParts.push(`İl: ${data.il}`);
        if (data.ilce) extractedParts.push(`İlçe: ${data.ilce}`);
        if (data.mahalle) extractedParts.push(`Mahalle: ${data.mahalle}`);
        if (data.ada_no) extractedParts.push(`Ada: ${data.ada_no}`);
        if (data.parsel_no) extractedParts.push(`Parsel: ${data.parsel_no}`);
        
        // İl, ilçe, mahalle bilgilerini dropdown'lara yaz
        const city = (locationsData.cities as City[]).find(
          c => c.Proparcel_text === data.il
        );
        
        if (city) {
          setSelectedCityId(city.Id);
          
          const town = city.Towns.find(t => t.Proparcel_text === data.ilce);
          if (town) {
            setSelectedTownId(town.Id);
            
            if (data.mahalle) {
              const quarter = town.Quarters.find(
                q => q.Tkgm_text === data.mahalle || q.Proparcel_text === data.mahalle
              );
              if (quarter) {
                setSelectedQuarterId(quarter.Id);
                setSelectedProparcelValue(quarter.Proparcel_value);
              }
            }
          }
        }

        // Ada ve parsel bilgilerini yaz
        if (data.ada_no) {
          setAda(data.ada_no);
        }
        if (data.parsel_no) {
          setParsel(data.parsel_no);
        }

        // Çıkarılan bilgileri input alanına ekle
        if (appendExtractedInfo && extractedParts.length > 0) {
          const extractedText = `\n\n[Çıkarılan Bilgiler]\n${extractedParts.join('\n')}`;
          setAkilliSorguText(prev => prev + extractedText);
        }

        Alert.alert('Başarılı', 'Bilgiler başarıyla çıkarıldı ve form dolduruldu.');
      } else {
        if (appendExtractedInfo) {
          const errorMsg = data.error || 'Metinden il/ilçe bilgisi çıkarılamadı.';
          setAkilliSorguText(prev => prev + `\n\n[Uyarı: ${errorMsg}]`);
        }
        Alert.alert('Uyarı', data.error || 'Metinden il/ilçe bilgisi çıkarılamadı.');
      }
    } catch (err) {
      console.error('Text query hatası:', err);
      if (appendExtractedInfo) {
        setAkilliSorguText(prev => prev + '\n\n[Hata: Metin işlenirken bir hata oluştu.]');
      }
      Alert.alert('Hata', 'Metin işlenirken bir hata oluştu.');
    } finally {
      if (!appendExtractedInfo) {
        setIsProcessingAudio(false);
      }
    }
  };

  // Component mount olduğunda audio modunu temizle
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        // Başlangıçta audio modunu temizle - önceki kayıt objelerini temizlemek için
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: false,
        });
      } catch (err) {
        // Hata olursa sessizce geç
      }
    };
    initializeAudio();
  }, []);

  // COMMENTED OUT: Image picker temporarily disabled
  // pickImageFromCamera, pickImageFromGallery, and processImage functions are disabled
  // See lines 763-832 for original implementation (commented out)

  // Component unmount olduğunda kayıt durdur
  useEffect(() => {
    return () => {
      if (recording) {
        recording.getStatusAsync().then((status: any) => {
          if (status.isLoaded && !status.isDoneRecording) {
            recording.stopAndUnloadAsync().catch((err) => {
              console.log('Cleanup: Recording zaten durdurulmuş', err);
            });
          }
        }).catch(() => {
          // Status alınamazsa sessizce geç
        });
      }
    };
  }, [recording]);

  const renderEmptyRows = () => (
    <>
      {[1, 2, 3].map((i) => (
        <View key={`empty-${i}`} style={styles.pickerItem}>
          <Text style={styles.pickerItemText}> </Text>
        </View>
      ))}
    </>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.formContainer}>
        {/* Tab Header */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'parsel' && styles.activeTabButton]}
            onPress={() => setActiveTab('parsel')}
          >
            <Text style={[styles.tabText, activeTab === 'parsel' && styles.activeTabText]}>Parsel Sorgu</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'akilli' && styles.activeTabButton]}
            onPress={() => setActiveTab('akilli')}
          >
            <Text style={[styles.tabText, activeTab === 'akilli' && styles.activeTabText]}>Akıllı Sorgu</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'parsel' ? (
          <View style={styles.form}>
            {/* İl Seçimi */}
            <View style={styles.fieldContainer}>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowIlPicker(true)}
              >
                <Text style={[styles.pickerText, !selectedCity && styles.placeholderText]}>
                  {selectedCity ? selectedCity.Proparcel_text : 'İl Seçiniz'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* İlçe Seçimi */}
            <View style={styles.fieldContainer}>
              <TouchableOpacity
                style={[styles.picker, !selectedCity && styles.pickerDisabled]}
                onPress={() => selectedCity && setShowIlcePicker(true)}
                disabled={!selectedCity}
              >
                <Text style={[styles.pickerText, !selectedTown && styles.placeholderText]}>
                  {selectedTown ? selectedTown.Proparcel_text : 'İlçe Seçiniz'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Mahalle Seçimi */}
            <View style={styles.fieldContainer}>
              <TouchableOpacity
                style={[styles.picker, !selectedTown && styles.pickerDisabled]}
                onPress={() => selectedTown && setShowMahallePicker(true)}
                disabled={!selectedTown}
              >
                <Text style={[styles.pickerText, !selectedQuarter && styles.placeholderText]}>
                  {selectedQuarter 
                    ? (selectedQuarter.Proparcel_text && selectedQuarter.Proparcel_text.trim() !== ''
                        ? `${selectedQuarter.Tkgm_text} (${selectedQuarter.Proparcel_text})`
                        : selectedQuarter.Tkgm_text)
                    : 'Mahalle Seçiniz'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Ada */}
            <View style={styles.fieldContainer}>
              <TextInput
                style={styles.input}
                placeholder="Ada"
                placeholderTextColor="#999"
                value={ada}
                onChangeText={(text) => handleNumericInput(text, setAda)}
                keyboardType="numeric"
              />
            </View>

            {/* Parsel */}
            <View style={styles.fieldContainer}>
              <TextInput
                style={styles.input}
                placeholder="Parsel"
                placeholderTextColor="#999"
                value={parsel}
                onChangeText={(text) => handleNumericInput(text, setParsel)}
                keyboardType="numeric"
              />
            </View>

            {/* Butonlar */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={handleSorgula}
              >
                <Ionicons name="search" size={20} color="#fff" />
                <Text style={styles.buttonText}>Sorgula</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={onClose}
              >
                <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
                <Text style={[styles.secondaryButtonText, { color: '#ef4444' }]}>İptal</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            {/* Akıllı Sorgu Input */}
            <View style={styles.fieldContainer}>
              <TextInput
                style={[styles.input, styles.akilliSorguInput]}
                placeholder="Sorgu metninizi girin veya ses/resim ile sorgulayın..."
                placeholderTextColor="#999"
                value={akilliSorguText}
                onChangeText={setAkilliSorguText}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Mikrofon ve Resim Butonları */}
            <View style={styles.akilliSorguButtons}>
              <TouchableOpacity
                style={[
                  styles.akilliSorguButton, 
                  styles.microphoneButton,
                  isRecording && styles.recordingButton,
                  (isProcessingAudio || isRecording) && styles.disabledButton
                ]}
                onPress={isRecording ? stopRecording : startRecording}
                disabled={isProcessingAudio}
              >
                {isProcessingAudio ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons 
                      name={isRecording ? "stop" : "mic"} 
                      size={24} 
                      color="#fff" 
                    />
                    <Text style={styles.akilliSorguButtonText}>
                      {isRecording ? 'Kaydı Durdur' : 'Mikrofon'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* COMMENTED OUT: Image picker button temporarily disabled */}
            </View>

            {/* Sorgula Butonu */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={() => {
                  if (!akilliSorguText.trim()) {
                    alert('Lütfen sorgu metni girin veya ses/resim ile sorgulayın');
                    return;
                  }
                  // TODO: API'ye sorgu gönder
                  alert(`Sorgu: ${akilliSorguText}`);
                  console.log('Akıllı sorgu:', akilliSorguText);
                }}
                disabled={!akilliSorguText.trim()}
              >
                <Ionicons name="search" size={20} color="#fff" />
                <Text style={styles.buttonText}>Sorgula</Text>
              </TouchableOpacity>

              {/* İptal Butonu */}
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={onClose}
              >
                <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
                <Text style={[styles.secondaryButtonText, { color: '#ef4444' }]}>İptal</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Debug Butonu */}
      <TouchableOpacity
        style={styles.debugButton}
        onPress={() => setShowDebugPanel(!showDebugPanel)}
      >
        <Ionicons name="bug" size={20} color="#fff" />
      </TouchableOpacity>

      {/* Debug Panel Modal */}
      <Modal
        visible={showDebugPanel}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDebugPanel(false)}
      >
        <View style={styles.debugPanelOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowDebugPanel(false)}>
            <View style={styles.debugPanelOverlayTouchable} />
          </TouchableWithoutFeedback>
          <View style={styles.debugPanel}>
            <View style={styles.debugPanelHeader}>
              <Text style={styles.debugPanelTitle}>Debug Logları</Text>
              <View style={styles.debugPanelHeaderButtons}>
                <TouchableOpacity
                  onPress={() => setDebugLogs([])}
                  style={styles.debugClearButton}
                >
                  <Text style={styles.debugClearButtonText}>Temizle</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowDebugPanel(false)}
                  style={styles.debugCloseButton}
                >
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView style={styles.debugLogContainer}>
              {debugLogs.length === 0 ? (
                <Text style={styles.debugLogText}>Henüz log yok</Text>
              ) : (
                debugLogs.map((log, index) => (
                  <Text key={index} style={styles.debugLogText}>
                    {log}
                  </Text>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* COMMENTED OUT: Image picker modal temporarily disabled - see lines 687-753 for pickImageFromCamera and pickImageFromGallery functions */}

      {/* İl Picker Modal */}
      <Modal 
        visible={showIlPicker} 
        transparent 
        animationType="slide"
        onRequestClose={() => setShowIlPicker(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            onPress={() => setShowIlPicker(false)} 
          />
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>İl Seçiniz</Text>
              <TouchableOpacity onPress={() => {
                setShowIlPicker(false);
                setIlSearchText('');
              }}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="İl ara..."
                placeholderTextColor="#999"
                value={ilSearchText}
                onChangeText={setIlSearchText}
                autoCapitalize="words"
              />
              {ilSearchText.length > 0 && (
                <TouchableOpacity onPress={() => setIlSearchText('')}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView 
              style={styles.pickerScrollView}
              contentContainerStyle={styles.pickerScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {filteredCities.length > 0 ? (
                filteredCities.map((city) => (
                  <TouchableOpacity
                    key={city.Id}
                    style={styles.pickerItem}
                    onPress={() => handleIlSelect(city)}
                  >
                    <Text style={styles.pickerItemText}>{city.Proparcel_text}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Sonuç bulunamadı</Text>
                </View>
              )}
              {renderEmptyRows()}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* İlçe Picker Modal */}
      <Modal 
        visible={showIlcePicker} 
        transparent 
        animationType="slide"
        onRequestClose={() => setShowIlcePicker(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            onPress={() => setShowIlcePicker(false)} 
          />
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>İlçe Seçiniz</Text>
              <TouchableOpacity onPress={() => {
                setShowIlcePicker(false);
                setIlceSearchText('');
              }}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="İlçe ara..."
                placeholderTextColor="#999"
                value={ilceSearchText}
                onChangeText={setIlceSearchText}
                autoCapitalize="words"
              />
              {ilceSearchText.length > 0 && (
                <TouchableOpacity onPress={() => setIlceSearchText('')}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView 
              style={styles.pickerScrollView}
              contentContainerStyle={styles.pickerScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {filteredTowns.length > 0 ? (
                filteredTowns.map((town) => (
                  <TouchableOpacity
                    key={town.Id}
                    style={styles.pickerItem}
                    onPress={() => handleIlceSelect(town)}
                  >
                    <Text style={styles.pickerItemText}>{town.Proparcel_text}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Sonuç bulunamadı</Text>
                </View>
              )}
              {renderEmptyRows()}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Mahalle Picker Modal */}
      <Modal 
        visible={showMahallePicker} 
        transparent 
        animationType="slide"
        onRequestClose={() => setShowMahallePicker(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            onPress={() => setShowMahallePicker(false)} 
          />
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Mahalle Seçiniz</Text>
              <TouchableOpacity onPress={() => {
                setShowMahallePicker(false);
                setMahalleSearchText('');
              }}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Mahalle ara..."
                placeholderTextColor="#999"
                value={mahalleSearchText}
                onChangeText={setMahalleSearchText}
                autoCapitalize="words"
              />
              {mahalleSearchText.length > 0 && (
                <TouchableOpacity onPress={() => setMahalleSearchText('')}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView 
              style={styles.pickerScrollView}
              contentContainerStyle={styles.pickerScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {filteredQuarters.length > 0 ? (
                filteredQuarters.map((quarter) => {
                  // Ana projedeki format: Tkgm_text (Proparcel_text)
                  const displayText = quarter.Proparcel_text && quarter.Proparcel_text.trim() !== ''
                    ? `${quarter.Tkgm_text} (${quarter.Proparcel_text})`
                    : quarter.Tkgm_text;
                  
                  return (
                    <TouchableOpacity
                      key={quarter.Id}
                      style={styles.pickerItem}
                      onPress={() => handleMahalleSelect(quarter)}
                    >
                      <Text style={styles.pickerItemText}>{displayText}</Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Sonuç bulunamadı</Text>
                </View>
              )}
              {renderEmptyRows()}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: '#1e293b',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#94a3b8',
  },
  activeTabText: {
    color: '#1e293b',
    fontWeight: 'bold',
  },
  emptyTabContent: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#f9fafb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  form: {
    padding: 16,
  },
  fieldContainer: {
    marginBottom: 12,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  pickerDisabled: {
    backgroundColor: '#f5f5f5',
    opacity: 0.6,
  },
  pickerText: {
    fontSize: 16,
    color: '#1f2937',
  },
  placeholderText: {
    color: '#999',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#fff',
  },
  buttonContainer: {
    marginTop: 24,
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#1e293b',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '70%',
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  pickerItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#1f2937',
  },
  pickerScrollView: {
    flex: 1,
  },
  pickerScrollContent: {
    flexGrow: 1,
  },
  akilliSorguInput: {
    minHeight: 120,
    paddingTop: 12,
    paddingBottom: 12,
  },
  akilliSorguButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  akilliSorguButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  microphoneButton: {
    backgroundColor: '#3b82f6',
  },
  imageButton: {
    backgroundColor: '#10b981',
  },
  searchButton: {
    backgroundColor: '#1e293b',
  },
  akilliSorguButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  recordingButton: {
    backgroundColor: '#ef4444',
  },
  disabledButton: {
    opacity: 0.6,
  },
  debugButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 1000,
  },
  debugPanelOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  debugPanelOverlayTouchable: {
    flex: 1,
  },
  debugPanel: {
    height: '60%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '80%',
  },
  debugPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 12,
  },
  debugPanelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  debugPanelHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  debugClearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
  },
  debugClearButtonText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
  },
  debugCloseButton: {
    padding: 4,
  },
  debugLogContainer: {
    flex: 1,
    marginTop: 8,
  },
  debugLogText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#333',
    marginBottom: 6,
    padding: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
  },
  // COMMENTED OUT: Image picker styles temporarily disabled
  /*
  imagePickerModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    margin: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  imagePickerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
  },
  imagePickerButtons: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },
  imagePickerButton: {
    width: 100,
    height: 100,
    backgroundColor: '#10b981',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imagePickerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  imagePickerCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  imagePickerCancelText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
  */
});

export default AdaParselForm;
