import { Image } from "react-native";

type BrandVariant = "symbol" | "full" | "wordmark";
type BrandMode = "light" | "dark";

type Props = {
  variant: BrandVariant;
  mode?: BrandMode;
  width?: number;
};

const assets = {
  symbol: require("../../assets/images/brand/fitmap-logo-symbol.png"),
  full: {
    light: require("../../assets/images/brand/fitmap-logo-full-light.png"),
    dark: require("../../assets/images/brand/fitmap-logo-full-dark.png"),
  },
  wordmark: {
    light: require("../../assets/images/brand/fitmap-wordmark-light.png"),
    dark: require("../../assets/images/brand/fitmap-wordmark-dark.png"),
  },
};

export default function FitMapBrand({
  variant,
  mode = "light",
  width = 150,
}: Props) {
  const source = variant === "symbol" ? assets.symbol : assets[variant][mode];

  const dimensions = Image.resolveAssetSource(source);
  const assetWidth = dimensions?.width ?? 0;
  const assetHeight = dimensions?.height ?? 0;

  const fallbackAspectRatios = {
    symbol: 1,
    full: 990 / 350,
    wordmark: 952 / 240,
  };

  const aspectRatio =
    assetWidth > 0 && assetHeight > 0
      ? assetWidth / assetHeight
      : fallbackAspectRatios[variant];

  return (
    <Image
      source={source}
      resizeMode="contain"
      accessible
      accessibilityLabel="FIT Map"
      style={{
        width,
        aspectRatio,
      }}
    />
  );
}
