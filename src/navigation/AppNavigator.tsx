import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import {
  ChartNoAxesColumnIncreasing,
  Dumbbell,
  House,
  MapPin,
} from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CreateWorkoutScreen from "../screens/CreateWorkoutScreen";
import ExerciseCatalogScreen from "../screens/ExerciseCatalogScreen";
import GymDetailsScreen from "../screens/GymDetailsScreen";
import HomeScreen from "../screens/HomeScreen";
import MapScreen from "../screens/MapScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ProgressScreen from "../screens/ProgressScreen";
import WorkoutDetailsScreen from "../screens/WorkoutDetailsScreen";
import WorkoutExerciseConfigScreen from "../screens/WorkoutExerciseConfigScreen";
import WorkoutHistoryDetailsScreen from "../screens/WorkoutHistoryDetailsScreen";
import WorkoutHistoryScreen from "../screens/WorkoutHistoryScreen";
import WorkoutSessionScreen from "../screens/WorkoutSessionScreen";
import WorkoutsScreen from "../screens/WorkoutsScreen";
import { useAppTheme } from "../theme/ThemeProvider";
import type { AppStackParamList, MainTabParamList } from "./types";

const Stack = createNativeStackNavigator<AppStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabsNavigator() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();

  const light = theme.mode === "light";
  const accent = theme.colors.primary;
  const surface = theme.colors.surface;

  return (
    <Tab.Navigator
      initialRouteName="Home"
      backBehavior="history"
      screenOptions={({ route }) => ({
        headerStyle: {
          backgroundColor: surface,
        },
        headerTintColor: theme.colors.textPrimary,
        headerTitleStyle: {
          fontFamily: theme.typography.fontFamily.bold,
          fontSize: 18,
        },
        headerShadowVisible: false,

        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarHideOnKeyboard: true,

        tabBarLabelStyle: {
          fontFamily: theme.typography.fontFamily.bold,
          fontSize: 11,
          marginTop: 3,
        },

        tabBarIconStyle: { width: 58, height: 32 },

        tabBarStyle: {
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          height: 68 + insets.bottom,
          paddingTop: 9,
          paddingBottom: Math.max(insets.bottom, 6),
          backgroundColor: surface,
          borderTopColor: light ? "#ECD5C2" : theme.colors.border,
          borderTopWidth: 1,
          shadowColor: "#0F172A",
          shadowOpacity: light ? 0.13 : 0.18,
          shadowRadius: 12,
          shadowOffset: {
            width: 0,
            height: -3,
          },
          elevation: 8,
        },

        tabBarIcon: ({ color, focused }) => {
          const Icon =
            route.name === "Home"
              ? House
              : route.name === "Mapa"
                ? MapPin
                : route.name === "Treinos"
                  ? Dumbbell
                  : ChartNoAxesColumnIncreasing;

          return (
            <View
              style={{
                width: 56,
                height: 32,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 18,
                backgroundColor: focused ? theme.colors.primary : "transparent",
              }}
            >
              <Icon
                size={22}
                color={focused ? theme.colors.textOnPrimary : color}
                strokeWidth={focused ? 2.4 : 1.8}
              />
            </View>
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: "Início",
          headerShown: false,
        }}
      />

      <Tab.Screen
        name="Mapa"
        component={MapScreen}
        options={{
          title: "Mapa de academias",
          tabBarLabel: "Mapa",
        }}
      />

      <Tab.Screen
        name="Treinos"
        component={WorkoutsScreen}
        options={({ navigation }) => ({
          title: "Meus treinos",
          tabBarLabel: "Treinos",
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir histórico de treinos"
              onPress={() =>
                navigation
                  .getParent<NativeStackNavigationProp<AppStackParamList>>()
                  ?.navigate("HistoricoTreinos")
              }
              style={({ pressed }) => ({
                paddingHorizontal: 8,
                paddingVertical: 6,
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Text
                style={{
                  color: accent,
                  fontFamily: theme.typography.fontFamily.bold,
                  fontSize: theme.typography.size.small,
                }}
              >
                Histórico
              </Text>
            </Pressable>
          ),
        })}
      />

      <Tab.Screen
        name="Progresso"
        component={ProgressScreen}
        options={{
          title: "Meu progresso",
          tabBarLabel: "Progresso",
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { theme } = useAppTheme();

  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
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
        name="MainTabs"
        component={MainTabsNavigator}
        options={{ headerShown: false, title: "FIT Map" }}
      />

      <Stack.Screen
        name="Perfil"
        component={ProfileScreen}
        options={{
          title: "Meu perfil",
          headerBackButtonDisplayMode: "minimal",
        }}
      />

      <Stack.Screen
        name="NovoTreino"
        component={CreateWorkoutScreen}
        options={{ title: "Novo treino" }}
      />

      <Stack.Screen
        name="DetalhesTreino"
        component={WorkoutDetailsScreen}
        options={({ navigation, route }) => ({
          title: "Detalhes do treino",
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Executar treino"
              onPress={() =>
                navigation.navigate("ExecutarTreino", {
                  workoutId: route.params.workoutId,
                })
              }
              style={({ pressed }) => ({
                paddingHorizontal: 8,
                paddingVertical: 6,
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Text
                style={{
                  color: theme.colors.primary,
                  fontFamily: theme.typography.fontFamily.bold,
                  fontSize: theme.typography.size.small,
                }}
              >
                Treinar
              </Text>
            </Pressable>
          ),
        })}
      />

      <Stack.Screen
        name="ExecutarTreino"
        component={WorkoutSessionScreen}
        options={{ title: "Treino em andamento" }}
      />

      <Stack.Screen
        name="HistoricoTreinos"
        component={WorkoutHistoryScreen}
        options={{ title: "Histórico" }}
      />

      <Stack.Screen
        name="DetalhesHistoricoTreino"
        component={WorkoutHistoryDetailsScreen}
        options={{ title: "Treino concluído" }}
      />

      <Stack.Screen
        name="CatalogoExercicios"
        component={ExerciseCatalogScreen}
        options={{ title: "Adicionar exercício" }}
      />

      <Stack.Screen
        name="ConfigurarExercicioTreino"
        component={WorkoutExerciseConfigScreen}
        options={{ title: "Configurar exercício" }}
      />

      <Stack.Screen
        name="DetalhesAcademia"
        component={GymDetailsScreen}
        options={{
          title: "Detalhes da academia",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
    </Stack.Navigator>
  );
}
