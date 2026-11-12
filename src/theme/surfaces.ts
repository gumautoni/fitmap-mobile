import type { ViewStyle } from "react-native";

import type { AppTheme } from "./themes";

type SurfaceDepth = "standard" | "featured" | "hero";

export function lightSurfaceDepth(
  theme: AppTheme,
  depth: SurfaceDepth = "standard",
): ViewStyle {
  if (theme.mode !== "light") {
    return {};
  }

  if (depth === "hero") {
    return {
      backgroundColor: theme.colors.heroStart,
      shadowColor: "#C2410C",
      shadowOpacity: 0.22,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
    };
  }

  const featured = depth === "featured";

  return {
    borderColor: "#ECD5C2",
    shadowColor: "#94532F",
    shadowOpacity: featured ? 0.15 : 0.1,
    shadowRadius: featured ? 14 : 9,
    shadowOffset: {
      width: 0,
      height: featured ? 6 : 4,
    },
    elevation: featured ? 4 : 2,
  };
}

export function lightMetricDetail(theme: AppTheme): ViewStyle {
  if (theme.mode !== "light") {
    return {};
  }

  return {
    borderTopWidth: 2,
    borderTopColor: "#F4B98E",
  };
}
