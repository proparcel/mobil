/**

 * @format

 */

import { Platform } from 'react-native';

// iOS dev client (development IPA). App Store / IOS_STANDALONE native'de yok; production'da require etme.
if (Platform.OS === 'ios' && __DEV__) {
  require('expo-dev-client');
}

import 'react-native-gesture-handler';

import './mapbox-init';

import { registerRootComponent } from 'expo';

import { AppRegistry, LogBox } from 'react-native';

import App from './App';



LogBox.ignoreLogs([]);



if (__DEV__ && global.ErrorUtils?.setGlobalHandler) {

  const prev = global.ErrorUtils.getGlobalHandler?.();

  global.ErrorUtils.setGlobalHandler((error, isFatal) => {

    console.error('[ProParcel] JS', isFatal ? 'FATAL' : 'error', error?.message, error?.stack);

    prev?.(error, isFatal);

  });

}



// iOS EAS dev client: "main". Android RN CLI: yalnizca "ProParcel" (Expo dev menusu acilmasin).
if (Platform.OS === 'ios') {
  registerRootComponent(App);
} else {
  AppRegistry.registerComponent('ProParcel', () => App);
}


