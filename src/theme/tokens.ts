export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 20,
  "2xl": 24,
  full: 999,
} as const;

export const typography = {
  fontFamily: {
    regular: "Manrope_400Regular",
    medium: "Manrope_500Medium",
    semibold: "Manrope_600SemiBold",
    bold: "Manrope_700Bold",
    extrabold: "Manrope_800ExtraBold",
  },

  size: {
    caption: 12,
    small: 13,
    body: 15,
    bodyLarge: 16,
    cardTitle: 17,
    sectionTitle: 20,
    screenTitle: 26,
    display: 32,
    metric: 34,
  },

  lineHeight: {
    caption: 16,
    small: 18,
    body: 22,
    bodyLarge: 24,
    cardTitle: 23,
    sectionTitle: 26,
    screenTitle: 32,
    display: 38,
    metric: 40,
  },
} as const;
