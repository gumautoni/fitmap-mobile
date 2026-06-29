import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AddTaskScreen from '../screens/AddTaskScreen';
import CameraScreen from '../screens/CameraScreen';
import GymDetailsScreen from '../screens/GymDetailsScreen';
import HomeScreen from '../screens/HomeScreen';
import MapScreen from '../screens/MapScreen';
import TasksScreen from '../screens/TasksScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#111827',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '900',
          fontSize: 18,
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: '#F3F4F6',
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'FitMap',
        }}
      />

      <Stack.Screen
        name="Mapa"
        component={MapScreen}
        options={{
          title: 'Mapa de academias',
        }}
      />

      <Stack.Screen
        name="Tarefas"
        component={TasksScreen}
        options={{
          title: 'Exercícios',
        }}
      />

      <Stack.Screen
        name="NovaTarefa"
        component={AddTaskScreen}
        options={{
          title: 'Novo exercício',
        }}
      />

      <Stack.Screen
        name="Camera"
        component={CameraScreen}
        options={{
          title: 'Registrar exercício',
        }}
      />

      <Stack.Screen
        name="DetalhesAcademia"
        component={GymDetailsScreen}
        options={{
          title: 'Detalhes da academia',
        }}
      />
    </Stack.Navigator>
  );
}