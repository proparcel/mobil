import { PermissionsAndroid, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as ExpoImagePicker from 'expo-image-picker';
import { PermissionStatus } from 'expo-modules-core';

export type PermissionEnsureResult = {
  granted: boolean;
  /** Kalıcı red — sistem sheet bir daha açılamaz. */
  blocked: boolean;
};

const ANDROID_RECORD_AUDIO = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;

function fromExpoPermission(response: {
  granted?: boolean;
  canAskAgain?: boolean;
  status?: PermissionStatus;
}): PermissionEnsureResult {
  const granted =
    response.granted === true || response.status === PermissionStatus.GRANTED;
  const blocked = !granted && response.canAskAgain === false;
  return { granted, blocked };
}

async function ensureAndroidMicrophonePermission(): Promise<PermissionEnsureResult> {
  if (await PermissionsAndroid.check(ANDROID_RECORD_AUDIO)) {
    return { granted: true, blocked: false };
  }

  // Kamera ile aynı: Android sistem izin bottom sheet.
  const result = await PermissionsAndroid.request(ANDROID_RECORD_AUDIO);

  if (result === PermissionsAndroid.RESULTS.GRANTED) {
    return { granted: true, blocked: false };
  }
  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    return { granted: false, blocked: true };
  }
  return { granted: false, blocked: false };
}

/** Mikrofon — Android: PermissionsAndroid sheet, iOS: expo-av dialog. */
export async function ensureMicrophonePermission(): Promise<PermissionEnsureResult> {
  if (Platform.OS === 'android') {
    return ensureAndroidMicrophonePermission();
  }

  const current = await Audio.getPermissionsAsync();
  if (current.granted) {
    return { granted: true, blocked: false };
  }

  const requested = await Audio.requestPermissionsAsync();
  return fromExpoPermission(requested);
}

/** Kamera — expo-image-picker sistem izin sheet / dialog. */
export async function ensureCameraPermission(): Promise<PermissionEnsureResult> {
  const current = await ExpoImagePicker.getCameraPermissionsAsync();
  if (current.granted) {
    return { granted: true, blocked: false };
  }

  const requested = await ExpoImagePicker.requestCameraPermissionsAsync();
  return fromExpoPermission(requested);
}

export function permissionDeniedHint(kind: 'camera' | 'microphone'): string {
  return kind === 'camera'
    ? 'Kamera izni verilmedi. Tekrar denemek için kamera butonuna basın.'
    : 'Mikrofon izni verilmedi. Tekrar denemek için kayıt butonuna basın.';
}

export function permissionBlockedHint(kind: 'camera' | 'microphone'): string {
  return kind === 'camera'
    ? 'Kamera izni kapalı. Telefon ayarlarından ProParcel için kamerayı açın.'
    : 'Mikrofon izni kapalı. Telefon ayarlarından ProParcel için mikrofonu açın.';
}
