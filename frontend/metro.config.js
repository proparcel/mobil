// metro.config.js
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { load: loadExpoEnv } = require("@expo/env");
const { FileStore } = require("metro-cache");

// .env → process.env (EXPO_PUBLIC_MAPBOX_TOKEN vb.) — react-native start ile de calissin
loadExpoEnv(path.resolve(__dirname));

const config = getDefaultConfig(__dirname);

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];

// @turf paketlerinin doğru şekilde çözülmesi için resolver ayarları
config.resolver = config.resolver || {};
// Expo varsayılanlarını koru; proje node_modules'ı ekle (üzerine yazma)
const projectNodeModules = path.resolve(__dirname, 'node_modules');
const defaultNodeModulesPaths = config.resolver.nodeModulesPaths || [];
if (!defaultNodeModulesPaths.includes(projectNodeModules)) {
  config.resolver.nodeModulesPaths = [...defaultNodeModulesPaths, projectNodeModules];
}

// Extra node modules paths - nested dependencies için
const extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  '@turf/helpers': path.resolve(__dirname, 'node_modules/@turf/helpers'),
  '@turf/meta': path.resolve(__dirname, 'node_modules/@turf/meta'),
};
config.resolver.extraNodeModules = extraNodeModules;

const portalEntry = path.resolve(
  __dirname,
  'node_modules/@gorhom/portal/lib/commonjs/index.js',
);

config.resolver.alias = {
  ...(config.resolver.alias || {}),
  "@": path.resolve(__dirname),
  "@gorhom/portal": portalEntry,
};

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@gorhom/portal') {
    return { type: 'sourceFile', filePath: portalEntry };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Windows: node_modules icindeki android/ios build ciktilari Metro watcher'i dusurur (ENOENT).
const nodeNativeBuildBlock = /node_modules[\\/].*[\\/](android|ios)[\\/].*/;
const nodeBuildIntermediatesBlock = /node_modules[\\/].*[\\/]build[\\/]intermediates[\\/].*/;
const projectAndroidBuildBlock = /[\\/]android[\\/](build|\.gradle)[\\/].*/;
const existingBlockList = config.resolver.blockList;
const blockPatterns = [nodeNativeBuildBlock, nodeBuildIntermediatesBlock, projectAndroidBuildBlock];
if (existingBlockList) {
  config.resolver.blockList = Array.isArray(existingBlockList)
    ? [...existingBlockList, ...blockPatterns]
    : [existingBlockList, ...blockPatterns];
} else {
  config.resolver.blockList = blockPatterns;
}

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 2;

const fs = require('fs');
const TERRAIN_LOG_DIR = path.join(__dirname, 'logs', 'terrain3d');

config.server = config.server || {};
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    if (req.url?.startsWith('/terrain-log') && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          fs.mkdirSync(TERRAIN_LOG_DIR, { recursive: true });
          const parsed = JSON.parse(body || '{}');
          const attemptId = parsed.attemptId || `unknown_${Date.now()}`;
          const filePath = path.join(TERRAIN_LOG_DIR, `${attemptId}.json`);
          fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2));
          fs.writeFileSync(
            path.join(TERRAIN_LOG_DIR, 'latest.json'),
            JSON.stringify(
              { attemptId, file: filePath, savedAt: new Date().toISOString() },
              null,
              2,
            ),
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, attemptId, file: filePath }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: String(error) }));
        }
      });
      return;
    }
    return middleware(req, res, next);
  };
};

module.exports = config;
