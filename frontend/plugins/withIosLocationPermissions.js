const { withInfoPlist } = require("expo/config-plugins");

/** EAS / expo prebuild: iOS konum izni metinleri (react-native-geolocation-service whenInUse) */
const LOCATION_WHEN_IN_USE_TR =
  "ProParcel, haritada konumunuzu göstermek, Konumum ve size yakın harita görünümü için konumunuza erişir.";

module.exports = function withIosLocationPermissions(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.NSLocationWhenInUseUsageDescription = LOCATION_WHEN_IN_USE_TR;
    return cfg;
  });
};
