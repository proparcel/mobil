import { Platform, Vibration } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const HAPTIC_OPTIONS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: true,
} as const;

/** Devlet/kamu parsel uyarısı — belirgin çift titreşim. */
export function triggerGovernmentParcelAlertHaptic(): void {
  try {
    ReactNativeHapticFeedback.trigger('notificationWarning', HAPTIC_OPTIONS);
    setTimeout(() => {
      try {
        ReactNativeHapticFeedback.trigger('impactHeavy', HAPTIC_OPTIONS);
      } catch {
        // ignore
      }
    }, 120);
  } catch {
    // ignore
  }
  if (Platform.OS === 'android') {
    try {
      Vibration.vibrate([0, 120, 80, 160]);
    } catch {
      // ignore
    }
  }
}