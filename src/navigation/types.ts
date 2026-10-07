import type { NativeStackScreenProps } from "@react-navigation/native-stack";

export type AppStackParamList = {
  Home: undefined;
  Mapa: undefined;
  Tarefas: undefined;
  NovaTarefa: undefined;
  Camera: {
    taskId: string;
    taskTitle: string;
  };
  DetalhesAcademia: {
    gymId: string;
    distanceKm?: number | null;
  };
};

export type AuthStackParamList = {
  Login: undefined;
  Cadastro: undefined;
};

export type AppStackScreenProps<RouteName extends keyof AppStackParamList> =
  NativeStackScreenProps<AppStackParamList, RouteName>;

export type AuthStackScreenProps<RouteName extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, RouteName>;
