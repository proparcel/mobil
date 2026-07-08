const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const GIT_SOURCE = "source 'https://github.com/CocoaPods/Specs.git'";

/** CocoaPods CDN (GitHub raw) 429 hatalarinda git specs kaynagina gec. */
module.exports = function withIosPodfileGitSource(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      if (!fs.existsSync(podfilePath)) return cfg;

      let contents = fs.readFileSync(podfilePath, "utf8");
      if (contents.includes(GIT_SOURCE)) return cfg;

      contents = contents.replace(/^source\s+['"]https:\/\/cdn\.cocoapods\.org\/?['"]\s*\n?/m, "");
      contents = `${GIT_SOURCE}\n${contents}`;
      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
};
