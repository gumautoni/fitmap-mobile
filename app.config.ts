import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const { name, slug } = config;

  if (!name || !slug) {
    throw new Error("FitMap Expo configuration requires name and slug.");
  }

  const resolvedConfig: ExpoConfig = { ...config, name, slug };

  const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

  if (!androidGoogleMapsApiKey) {
    return resolvedConfig;
  }

  return {
    ...resolvedConfig,
    plugins: [
      ...(resolvedConfig.plugins ?? []),
      ["react-native-maps", { androidGoogleMapsApiKey }],
    ],
  };
};
