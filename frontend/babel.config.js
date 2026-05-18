module.exports = function (api) {
  api.cache(true);

  // Router root'u build-time'da sabitle (ikonla açılışta da geçerli olur)
  // Bu sayede uygulama ikonundan açıldığında da EXPO_ROUTER_APP_ROOT doğru ayarlanır
  process.env.EXPO_ROUTER_APP_ROOT = "app/routes";

  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["."],
          alias: { "@": "." },
          extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
        },
      ],
      "react-native-reanimated/plugin",
    ],
  };
};

