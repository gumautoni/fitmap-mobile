import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

export type MainTabParamList = {
  Home: undefined;
  Mapa: undefined;
  Treinos: undefined;
  Progresso: undefined;
};

export type AppStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Perfil: undefined;
  NovoTreino: undefined;
  DetalhesTreino: {
    workoutId: string;
  };
  ExecutarTreino: {
    workoutId?: string;
  };
  HistoricoTreinos: undefined;
  DetalhesHistoricoTreino: {
    workoutSessionId: string;
  };
  CatalogoExercicios: {
    workoutId: string;
  };
  ConfigurarExercicioTreino: {
    workoutId: string;
    workoutExerciseId: string;
  };
  DetalhesAcademia: {
    gymId: string;
    distanceKm?: number | null;
  };
};

export type AuthStackParamList = {
  BoasVindas: undefined;
  Login: undefined;
  Cadastro: undefined;
};

export type AppStackScreenProps<RouteName extends keyof AppStackParamList> =
  NativeStackScreenProps<AppStackParamList, RouteName>;

export type AppTabScreenProps<RouteName extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, RouteName>,
    NativeStackScreenProps<AppStackParamList, "MainTabs">
  >;

export type AuthStackScreenProps<RouteName extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, RouteName>;
