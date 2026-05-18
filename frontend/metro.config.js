// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];

// @turf paketlerinin doğru şekilde çözülmesi için resolver ayarları
config.resolver = config.resolver || {};
// Ana node_modules'ı öncelikli hale getir (nested node_modules'lardan önce)
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

// Extra node modules paths - nested dependencies için
const extraNodeModules = {
  '@turf/helpers': path.resolve(__dirname, 'node_modules/@turf/helpers'),
  '@turf/meta': path.resolve(__dirname, 'node_modules/@turf/meta'),
};
config.resolver.extraNodeModules = extraNodeModules;

config.resolver.alias = {
  ...(config.resolver.alias || {}),
  "@": path.resolve(__dirname),
};

// // Exclude unnecessary directories from file watching
// config.watchFolders = [__dirname];
// config.resolver.blacklistRE = /(.*)\/(__tests__|android|ios|build|dist|.git|node_modules\/.*\/android|node_modules\/.*\/ios|node_modules\/.*\/windows|node_modules\/.*\/macos)(\/.*)?$/;

// // Alternative: use a more aggressive exclusion pattern
// config.resolver.blacklistRE = /node_modules\/.*\/(android|ios|windows|macos|__tests__|\.git|.*\.android\.js|.*\.ios\.js)$/;

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 2;

module.exports = config;
