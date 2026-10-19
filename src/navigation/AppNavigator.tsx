import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable, Text } from "react-native";

import AddTaskScreen from "../screens/AddTaskScreen";
import CameraScreen from "../screens/CameraScreen";
import CreateWorkoutScreen from "../screens/CreateWorkoutScreen";
import ExerciseCatalogScreen from "../screens/ExerciseCatalogScreen";
import GymDetailsScreen from "../screens/GymDetailsScreen";
import HomeScreen from "../screens/HomeScreen";
import MapScreen from "../screens/MapScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ProgressScreen from "../screens/ProgressScreen";
import TasksScreen from "../screens/TasksScreen";
import WorkoutDetailsScreen from "../screens/WorkoutDetailsScreen";
import WorkoutExerciseConfigScreen from "../screens/WorkoutExerciseConfigScreen";
import WorkoutHistoryDetailsScreen from "../screens/WorkoutHistoryDetailsScreen";
import WorkoutHistoryScreen from "../screens/WorkoutHistoryScreen";
import WorkoutSessionScreen from "../screens/WorkoutSessionScreen";
import WorkoutsScreen from "../screens/WorkoutsScreen";
import { useAppTheme } from "../theme/ThemeProvider";
import type { AppStackParamList } from "./types";

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
        name="Perfil"
        component={ProfileScreen}
        options={{
          title: "Meu perfil",
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
        name="Treinos"
        component={WorkoutsScreen}
        options={({ navigation }) => ({
          title: "Meus treinos",
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir histórico de treinos"
              onPress={() => navigation.navigate("HistoricoTreinos")}
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
                Histórico
              </Text>
            </Pressable>
          ),
        })}
      />

      <Stack.Screen
        name="NovoTreino"
        component={CreateWorkoutScreen}
        options={{
          title: "Novo treino",
        }}
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
        options={{
          title: "Treino em andamento",
        }}
      />

      <Stack.Screen
        name="HistoricoTreinos"
        component={WorkoutHistoryScreen}
        options={{
          title: "Histórico",
        }}
      />

      <Stack.Screen
        name="DetalhesHistoricoTreino"
        component={WorkoutHistoryDetailsScreen}
        options={{
          title: "Treino concluído",
        }}
      />

      <Stack.Screen
        name="Progresso"
        component={ProgressScreen}
        options={{
          title: "Meu progresso",
        }}
      />

      <Stack.Screen
        name="CatalogoExercicios"
        component={ExerciseCatalogScreen}
        options={{
          title: "Adicionar exercício",
        }}
      />

      <Stack.Screen
        name="ConfigurarExercicioTreino"
        component={WorkoutExerciseConfigScreen}
        options={{
          title: "Configurar exercício",
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
