import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { AppStackParamList } from "./types";
import AddTaskScreen from "../screens/AddTaskScreen";
import CameraScreen from "../screens/CameraScreen";
import GymDetailsScreen from "../screens/GymDetailsScreen";
import HomeScreen from "../screens/HomeScreen";
import MapScreen from "../screens/MapScreen";
import TasksScreen from "../screens/TasksScreen";
import { useAppTheme } from "../theme/ThemeProvider";

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppNavigator() {
  const { theme } = useAppTheme();

  return (
    <Stack.Navigator
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
        name="Home"
        component={HomeScreen}
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="Mapa"
        component={MapScreen}
        options={{
          title: "Mapa de academias",
        }}
      />

      <Stack.Screen
        name="Tarefas"
        component={TasksScreen}
        options={{
          title: "Exercícios",
        }}
      />

      <Stack.Screen
        name="NovaTarefa"
        component={AddTaskScreen}
        options={{
          title: "Novo exercício",
        }}
      />

      <Stack.Screen
        name="Camera"
        component={CameraScreen}
        options={{
          title: "Registrar exercício",
        }}
      />

      <Stack.Screen
        name="DetalhesAcademia"
        component={GymDetailsScreen}
        options={{
          title: "Detalhes da academia",
        }}
      />
    </Stack.Navigator>
  );
}
