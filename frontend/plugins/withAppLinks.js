const { withAndroidManifest, AndroidConfig } = require("expo/config-plugins");
const { withEntitlementsPlist } = require("expo/config-plugins");

const IOS_BUNDLE_ID = "com.proparcel.app";
const ANDROID_PACKAGE = "com.proparcel.mobile";
const ASSOCIATED_DOMAINS = ["applinks:proparcel.com", "applinks:www.proparcel.com"];

const HTTPS_PATH_PREFIXES = ["/query", "/portal/recent-queries", "/go"];

function withIosAssociatedDomains(config) {
  return withEntitlementsPlist(config, (cfg) => {
    cfg.modResults["com.apple.developer.associated-domains"] = ASSOCIATED_DOMAINS;
    return cfg;
  });
}

function withAndroidAppLinks(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    if (!app.activity) app.activity = [];

    const mainActivity = app.activity.find(
      (a) => a.$["android:name"] === ".MainActivity" || String(a.$["android:name"] || "").includes("MainActivity"),
    );
    if (!mainActivity) return cfg;

    mainActivity["intent-filter"] = mainActivity["intent-filter"] || [];
    const filters = Array.isArray(mainActivity["intent-filter"])
      ? mainActivity["intent-filter"]
      : [mainActivity["intent-filter"]];

    const hosts = ["proparcel.com", "www.proparcel.com"];
    for (const host of hosts) {
      for (const prefix of HTTPS_PATH_PREFIXES) {
        const exists = filters.some((f) => {
          const data = f.data || [];
          const rows = Array.isArray(data) ? data : [data];
          return rows.some(
            (d) =>
              d.$?.["android:scheme"] === "https" &&
              d.$?.["android:host"] === host &&
              d.$?.["android:pathPrefix"] === prefix,
          );
        });
        if (exists) continue;

        filters.push({
          $: { "android:autoVerify": "true" },
          action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
          category: [
            { $: { "android:name": "android.intent.category.DEFAULT" } },
            { $: { "android:name": "android.intent.category.BROWSABLE" } },
          ],
          data: [
            {
              $: {
                "android:scheme": "https",
                "android:host": host,
                "android:pathPrefix": prefix,
              },
            },
          ],
        });
      }
    }

    mainActivity["intent-filter"] = filters;
    return cfg;
  });
}

/** iOS Universal Links + Android App Links (proparcel.com). */
module.exports = function withAppLinks(config) {
  // App Store profili Associated Domains icermiyorsa Xcode fail verir; portal + IOS_ASSOCIATED_DOMAINS=1 ile acilir.
  if (process.env.IOS_ASSOCIATED_DOMAINS === "1") {
    config = withIosAssociatedDomains(config);
  }
  config = withAndroidAppLinks(config);
  return config;
};

module.exports.IOS_BUNDLE_ID = IOS_BUNDLE_ID;
module.exports.ANDROID_PACKAGE = ANDROID_PACKAGE;
