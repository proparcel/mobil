const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");
const { patchAppManifestOptionalHardware } = require("./androidOptionalHardware");

module.exports = function withOptionalAndroidHardware(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const manifestPath = path.join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "AndroidManifest.xml",
      );
      patchAppManifestOptionalHardware(manifestPath);
      return cfg;
    },
  ]);
};
