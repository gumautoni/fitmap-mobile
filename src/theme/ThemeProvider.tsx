import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";

import {
  darkTheme,
  lightTheme,
  type AppTheme,
  type ThemeMode,
  type ThemePreference,
} from "./themes";

const THEME_STORAGE_KEY = "fitmap_theme_preference";

type ThemeContextValue = {
  theme: AppTheme;
  mode: ThemeMode;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => Promise<void>;
  isDark: boolean;
  loading: boolean;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

type ThemeProviderProps = {
  children: ReactNode;
};

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();

  const [preference, setPreferenceState] =
    useState<ThemePreference>("system");

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadPreference() {
      try {
        const storedPreference = await AsyncStorage.getItem(
          THEME_STORAGE_KEY,
        );

        if (active && isThemePreference(storedPreference)) {
          setPreferenceState(storedPreference);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPreference();

    return () => {
      active = false;
    };
  }, []);

  const mode: ThemeMode =
    preference === "system"
      ? systemColorScheme === "dark"
        ? "dark"
        : "light"
      : preference;

  const theme = mode === "dark" ? darkTheme : lightTheme;

  const setPreference = useCallback(
    async (nextPreference: ThemePreference) => {
      await AsyncStorage.setItem(
        THEME_STORAGE_KEY,
        nextPreference,
      );

      setPreferenceState(nextPreference);
    },
    [],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      mode,
      preference,
      setPreference,
      isDark: mode === "dark",
      loading,
    }),
    [loading, mode, preference, setPreference, theme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useAppTheme must be used inside ThemeProvider.",
    );
  }

  return context;
}