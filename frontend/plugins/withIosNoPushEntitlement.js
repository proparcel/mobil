const { withEntitlementsPlist } = require("expo/config-plugins");

/** Ad-hoc profilde Push yoksa EAS/Xcode build'i icin aps-environment kaldirilir */
module.exports = function withIosNoPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults["aps-environment"];
    return cfg;
  });
}
