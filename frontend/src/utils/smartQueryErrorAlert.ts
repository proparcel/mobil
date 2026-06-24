import { Alert } from 'react-native';
import { shareSmartQueryDebugLog } from './smartQueryDebugLog';

/** Akıllı sorgu hatası — kullanıcı log paylaşabilir. */
export function showSmartQueryErrorAlert(
  message: string,
  title = 'Akıllı Sorgu',
): void {
  Alert.alert(title, message, [
    { text: 'Tamam', style: 'cancel' },
    {
      text: 'Log paylaş',
      onPress: () => {
        void shareSmartQueryDebugLog();
      },
    },
  ]);
}
