import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  NavigationContainer,
} from "@react-navigation/native";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/manrope";
import * as SplashScreen from "expo-splash-screen";
import { useContext, useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AuthContext, AuthProvider } from "./src/context/AuthContext";
import AppNavigator from "./src/navigation/AppNavigator";
import AuthNavigator from "./src/navigation/AuthNavigator";
import { ThemeProvider, useAppTheme } from "./src/theme/ThemeProvider";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function LoadingScreen() {
  const { theme, isDark } = useAppTheme();

  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.loadingContainer}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.colors.background}
      />

      <View style={styles.logoBox}>
        <Image
          source={require("./assets/images/logo-fitmap.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <ActivityIndicator size="large" color={theme.colors.primary} />

      <Text style={styles.loadingText}>Carregando FitMap...</Text>
    </View>
  );
}

function Routes() {
  const { user, loading } = useContext(AuthContext);
  const { theme, isDark } = useAppTheme();

  const navigationTheme = useMemo(() => {
    const baseTheme = isDark ? NavigationDarkTheme : NavigationDefaultTheme;

    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.textPrimary,
        border: theme.colors.border,
        notification: theme.colors.danger,
      },
    };
  }, [isDark, theme]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.colors.background}
      />

      <NavigationContainer theme={navigationTheme}>
        {user ? <AppNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </>
  );
}

function AppContent() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  if (fontError) {
    throw fontError;
  }

  if (!fontsLoaded) {
    return null;
  }

  void SplashScreen.hideAsync();

  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return <AppContent />;
}

function createStyles(theme) {
  return StyleSheet.create({
    loadingContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing["2xl"],
    },

    logoBox: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii["2xl"],
      padding: theme.spacing.lg,
      marginBottom: theme.spacing["2xl"],
      width: "100%",
      maxWidth: 280,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    logo: {
      width: 220,
      height: 140,
    },

    loadingText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.size.body,
      fontFamily: theme.typography.fontFamily.bold,
      marginTop: theme.spacing.md,
    },
  });
}
