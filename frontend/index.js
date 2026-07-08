/**

 * @format

 */

import { Platform } from 'react-native';

// iOS dev client (development IPA). App Store / IOS_STANDALONE native'de yok; production'da require etme.
if (Platform.OS === 'ios' && __DEV__) {
  require('expo-dev-client');
}

import 'react-native-gesture-handler';

import { enableScreens } from 'react-native-screens';
enableScreens(true);

import './mapbox-init';

import { registerRootComponent } from 'expo';

import { AppRegistry, LogBox } from 'react-native';

import App from './App';

const bootTag = `[ProParcel][${Platform.OS}]`;

LogBox.ignoreLogs([]);

if (__DEV__ && global.ErrorUtils?.setGlobalHandler) {
  const prev = global.ErrorUtils.getGlobalHandler?.();

  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error(bootTag, 'JS', isFatal ? 'FATAL' : 'error', error?.message, error?.stack);
    prev?.(error, isFatal);
  });
}

if (__DEV__) {
  console.log(bootTag, 'index.js evaluated');
}

// iOS EAS dev client: "main". Android RN CLI: yalnizca "ProParcel" (Expo dev menusu acilmasin).
if (Platform.OS === 'ios') {
  if (__DEV__) console.log(bootTag, 'registerRootComponent(App)');
  registerRootComponent(App);
} else {
  if (__DEV__) console.log(bootTag, 'AppRegistry.registerComponent(ProParcel)');
  AppRegistry.registerComponent('ProParcel', () => App);
}


