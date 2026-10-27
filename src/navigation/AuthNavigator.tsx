import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { AuthStackParamList } from "./types";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import WelcomeScreen from "../screens/WelcomeScreen";
import { useAppTheme } from "../theme/ThemeProvider";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  const { theme } = useAppTheme();

  return (
    <Stack.Navigator
      initialRouteName="BoasVindas"
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.textPrimary,
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily.bold,
          fontSize: 18,
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: theme.colors.background,
        },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen
        name="BoasVindas"
        component={WelcomeScreen}
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="Cadastro"
        component={RegisterScreen}
        options={{
          title: "Criar conta",
        }}
      />
    </Stack.Navigator>
  );
}
