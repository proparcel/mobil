/**
 * react-native-asset / prebuild: vector icon fontları iOS ve Android bundle'a eklenir.
 * Android: Expo Dev Client native modülleri RN CLI ile bağlanmasın.
 */
module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: [
    "./assets/fonts/",
    "./node_modules/react-native-vector-icons/Fonts",
  ],
  dependencies: {
    "expo-dev-client": { platforms: { android: null, ios: null } },
    "expo-dev-launcher": { platforms: { android: null, ios: null } },
    "expo-dev-menu": { platforms: { android: null, ios: null } },
    "expo-dev-menu-interface": { platforms: { android: null, ios: null } },
  },
};
