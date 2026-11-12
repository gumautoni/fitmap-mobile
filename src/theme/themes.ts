import { brandColors, radii, spacing, typography } from "./tokens";

export const lightColors = {
  primary: brandColors.orangeInk,
  primaryPressed: "#9A3412",
  primarySoft: brandColors.orangeSoft,

  heroStart: brandColors.orange,
  heroEnd: brandColors.gold,
  heroText: brandColors.graphite,
  heroTextMuted: "#30221B",
  heroDetail: "rgba(255, 255, 255, 0.22)",
  heroActionText: brandColors.orangeInk,

  techAccent: brandColors.turquoiseInk,
  performanceAccent: brandColors.gold,

  background: brandColors.warmWhite,
  surface: brandColors.warmSurface,
  surfaceSecondary: "#F1ECE5",

  textPrimary: brandColors.graphite,
  textSecondary: "#57534E",
  textMuted: "#78716C",
  textOnPrimary: "#FFFFFF",

  border: brandColors.warmBorder,
  divider: "#EDE7DF",

  success: "#16A36A",
  warning: "#F5A524",
  danger: "#D92D20",

  icon: "#57534E",
} as const;

export const darkColors = {
  primary: brandColors.orangeLight,
  primaryPressed: brandColors.orangeWarm,
  primarySoft: "#382419",

  heroStart: "#2B201C",
  heroEnd: "#78351D",
  heroText: "#FFFFFF",
  heroTextMuted: "#FFE0C5",
  heroDetail: "rgba(249, 115, 22, 0.22)",
  heroActionText: brandColors.orangeInk,

  techAccent: brandColors.turquoiseLight,
  performanceAccent: brandColors.gold,

  background: "#0E1118",
  surface: "#161B26",
  surfaceSecondary: "#1E2533",

  textPrimary: "#F7F8FA",
  textSecondary: "#B4BCCB",
  textMuted: "#929DAF",
  textOnPrimary: brandColors.graphite,

  border: "#2B3444",
  divider: "#252D3A",

  success: "#2FCB82",
  warning: "#F6B94D",
  danger: "#F97066",

  icon: "#AAB3C2",
} as const;

export const lightTheme = {
  mode: "light",
  colors: lightColors,
  spacing,
  radii,
  typography,
} as const;

export const darkTheme = {
  mode: "dark",
  colors: darkColors,
  spacing,
  radii,
  typography,
} as const;

export type AppTheme = typeof lightTheme | typeof darkTheme;
export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode | "system";
