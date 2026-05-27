const { printMapboxTokenStatus } = require("./mapbox-token-config");

const status = printMapboxTokenStatus({
  requirePublic: true,
  requireDownload: true,
});

process.exit(status.errors.length ? 1 : 0);
