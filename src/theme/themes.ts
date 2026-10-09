import { radii, spacing, typography } from "./tokens";

export const lightColors = {
  primary: "#3F51E8",
  primaryPressed: "#303FBE",
  primarySoft: "#EEF0FF",

  heroStart: "#3F51E8",
  heroEnd: "#303FBE",
  heroText: "#FFFFFF",
  heroTextMuted: "#DCE1FF",
  heroDetail: "rgba(255, 255, 255, 0.16)",

  techAccent: "#5CC8FF",
  performanceAccent: "#B8F04A",

  background: "#F7F8FA",
  surface: "#FFFFFF",
  surfaceSecondary: "#F1F3F7",

  textPrimary: "#171A21",
  textSecondary: "#667085",
  textMuted: "#98A2B3",
  textOnPrimary: "#FFFFFF",

  border: "#E5E7EC",
  divider: "#ECEEF2",

  success: "#16A36A",
  warning: "#F5A524",
  danger: "#D92D20",

  icon: "#667085",
} as const;

export const darkColors = {
  primary: "#6977FF",
  primaryPressed: "#5261F0",
  primarySoft: "#22294F",

  heroStart: "#1B2243",
  heroEnd: "#27337B",
  heroText: "#FFFFFF",
  heroTextMuted: "#C9D0FF",
  heroDetail: "rgba(105, 119, 255, 0.22)",

  techAccent: "#5CC8FF",
  performanceAccent: "#B8F04A",

  background: "#0E1118",
  surface: "#161B26",
  surfaceSecondary: "#1E2533",

  textPrimary: "#F7F8FA",
  textSecondary: "#B4BCCB",
  textMuted: "#7D8798",
  textOnPrimary: "#FFFFFF",

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
