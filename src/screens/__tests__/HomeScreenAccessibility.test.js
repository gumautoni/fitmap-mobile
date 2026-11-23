import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
} from "@testing-library/react-native";
import { Animated, StyleSheet } from "react-native";
import React from "react";

import { AuthContext } from "../../context/AuthContext";
import { getWorkouts } from "../../services/training";
import { getActiveWorkoutSession } from "../../services/trainingSessions";
import HomeScreen from "../HomeScreen";

jest.mock("../../context/AuthContext", () => {
  const React = jest.requireActual("react");

  return {
    AuthContext: React.createContext(null),
  };
});

jest.mock("@react-navigation/native", () => {
  const React = jest.requireActual("react");

  return {
    useFocusEffect(callback) {
      React.useEffect(callback, [callback]);
    },
  };
});

jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: () => ({
    theme: jest.requireActual("../../theme/themes").lightTheme,
  }),
}));

let mockReduceMotion = true;

jest.mock("../../hooks/useReducedMotion", () => ({
  useReducedMotion: () => mockReduceMotion,
}));

jest.mock(
  "../../components/MotionScrollView",
  () => jest.requireActual("react-native").ScrollView,
);

jest.mock("../../components/ScreenGradient", () => () => null);
jest.mock("../../components/FitMapBrand", () => () => null);

jest.mock("../../components/FitMapLocationGymPin3D", () => () => null);

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: jest.requireActual("react-native").View,
}));

jest.mock("lucide-react-native", () => ({
  ArrowRight: () => null,
  Dumbbell: () => null,
  TrendingUp: () => null,
  Zap: () => null,
}));

jest.mock("../../components/WorkoutActivityCalendar", () => {
  const React = jest.requireActual("react");
  const { Pressable, Text } = jest.requireActual("react-native");

  return function MockCalendar({ onOpenWorkout }) {
    return React.createElement(
      Pressable,
      {
        accessibilityRole: "button",
        accessibilityLabel: "Abrir treino do calendario",
        onPress: () => onOpenWorkout("history-session-test"),
      },
      React.createElement(Text, null, "Treino registrado"),
    );
  };
});

jest.mock("../../services/training", () => ({
  getWorkouts: jest.fn(),
}));

jest.mock("../../services/trainingSessions", () => ({
  getActiveWorkoutSession: jest.fn(),
}));

const navigation = {
  navigate: jest.fn(),
};

const token = "home-test-token";

const auth = {
  user: {
    name: "Ana Souza",
  },
  runAuthenticatedRequest: (request) => request(token),
};

async function mountHome() {
  return render(
    <AuthContext.Provider value={auth}>
      <HomeScreen navigation={navigation} />
    </AuthContext.Provider>,
  );
}

async function pressAction(label) {
  await fireEvent.press(screen.getByRole("button", { name: label }));
}

function expectTrainingCalls(workoutCalls) {
  expect(getActiveWorkoutSession).toHaveBeenCalledTimes(1);
  expect(getActiveWorkoutSession).toHaveBeenCalledWith(token);
  expect(getWorkouts).toHaveBeenCalledTimes(workoutCalls);

  if (workoutCalls > 0) {
    expect(getWorkouts).toHaveBeenCalledWith(token);
  }
}

describe("ACC-02.4 Home accessibility", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockReduceMotion = true;

    getActiveWorkoutSession.mockResolvedValue(null);
    getWorkouts.mockResolvedValue([{ id: "workout-test" }]);
  });

  it("accessibility: exposes headings, distinct shortcuts and practical touch targets", async () => {
    await mountHome();

    await screen.findByRole("button", {
      name: "Escolher treino",
    });

    for (const heading of [
      "Ol\u00e1, Ana",
      "Seu treino",
      "Acompanhe seu progresso",
    ]) {
      expect(screen.getByRole("header", { name: heading })).toBeTruthy();
    }

    const profile = screen.getByRole("button", {
      name: "Abrir meu perfil",
    });

    expect(profile).toHaveStyle({
      width: 48,
      height: 48,
    });

    for (const label of ["Abrir meus treinos", "Abrir meu progresso"]) {
      expect(screen.getByRole("button", { name: label })).toHaveStyle({
        minHeight: 48,
        minWidth: 48,
      });
    }

    const discovery = screen.getByRole("button", {
      name: "Explorar academias",
    });

    expect(discovery).toHaveProp(
      "accessibilityHint",
      "Busque por cidade, bairro ou sua localiza\u00e7\u00e3o.",
    );

    const progressCard = screen.getByRole("button", {
      name: "Consultar meu progresso",
    });

    expect(progressCard).toHaveProp(
      "accessibilityHint",
      "Consulte sua frequ\u00eancia de treino e a evolu\u00e7\u00e3o dos exerc\u00edcios conclu\u00eddos.",
    );

    await pressAction("Abrir meu perfil");
    await pressAction("Explorar academias");
    await pressAction("Abrir meus treinos");
    await pressAction("Abrir meu progresso");
    await pressAction("Consultar meu progresso");

    expect(navigation.navigate.mock.calls).toEqual([
      ["Perfil"],
      ["Mapa"],
      ["Treinos"],
      ["Progresso"],
      ["Progresso"],
    ]);

    expectTrainingCalls(1);
  });

  it("accessibility: identifies the active workout and preserves resume navigation", async () => {
    getActiveWorkoutSession.mockResolvedValueOnce({
      sourceWorkoutId: "active-workout-id",
      workoutName: "Treino A",
    });

    await mountHome();

    const action = await screen.findByRole("button", {
      name: "Continuar treino: Treino A",
    });

    expect(action).toHaveProp(
      "accessibilityHint",
      'Continue "Treino A" de onde parou.',
    );

    expect(action).toHaveProp(
      "accessibilityState",
      expect.objectContaining({
        busy: false,
      }),
    );

    expect(action).not.toBeDisabled();

    expect(screen.getByText("Treino em andamento")).toBeTruthy();

    await fireEvent.press(action);

    expect(navigation.navigate).toHaveBeenCalledTimes(1);

    expect(navigation.navigate).toHaveBeenCalledWith("ExecutarTreino", {
      workoutId: "active-workout-id",
    });

    expectTrainingCalls(0);
  });

  it("accessibility: describes available workouts and preserves selection navigation", async () => {
    await mountHome();

    const action = await screen.findByRole("button", {
      name: "Escolher treino",
    });

    expect(action).toHaveProp(
      "accessibilityHint",
      "Seus treinos estao prontos. Escolha um para comecar.",
    );

    expect(action).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ busy: false }),
    );

    expect(action).not.toBeDisabled();

    await fireEvent.press(action);

    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith("Treinos");

    expectTrainingCalls(1);
  });

  it("accessibility: describes the empty workout state and preserves creation navigation", async () => {
    getWorkouts.mockResolvedValueOnce([]);

    await mountHome();

    const action = await screen.findByRole("button", {
      name: "Criar primeiro treino",
    });

    expect(action).toHaveProp(
      "accessibilityHint",
      "Crie um treino para organizar exercicios e acompanhar sua evolucao.",
    );

    expect(action).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ busy: false }),
    );

    expect(screen.getByText("Seu primeiro treino")).toBeTruthy();

    await fireEvent.press(action);

    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith("NovoTreino");

    expectTrainingCalls(1);
  });

  it("accessibility: explains overview failure and preserves the fallback action", async () => {
    getActiveWorkoutSession.mockRejectedValueOnce(
      new Error("Connection failed"),
    );

    await mountHome();

    const guidance =
      "Nao foi possivel consultar os treinos agora. Acesse sua lista para tentar novamente.";

    await screen.findByText(guidance);

    const action = screen.getByRole("button", {
      name: "Ver meus treinos",
    });

    expect(action).toHaveProp("accessibilityHint", guidance);

    expect(action).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ busy: false }),
    );

    expect(action).not.toBeDisabled();

    await fireEvent.press(action);

    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith("Treinos");

    expectTrainingCalls(0);
  });

  it("accessibility: announces workout loading without disabling the existing shortcut", async () => {
    let resolveSession;

    const pending = new Promise((resolve) => {
      resolveSession = resolve;
    });

    getActiveWorkoutSession.mockReturnValueOnce(pending);

    await mountHome();

    try {
      const action = screen.getByRole("button", {
        name: "Ver meus treinos",
      });

      expect(action).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ busy: true }),
      );

      expect(action).toHaveProp(
        "accessibilityHint",
        "Carregando seus treinos...",
      );

      expect(action).not.toBeDisabled();

      await fireEvent.press(action);

      expect(navigation.navigate).toHaveBeenCalledTimes(1);

      expect(navigation.navigate).toHaveBeenCalledWith("Treinos");

      expectTrainingCalls(0);
    } finally {
      await act(async () => {
        resolveSession(null);
      });
    }

    const available = await screen.findByRole("button", {
      name: "Escolher treino",
    });

    expect(available).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ busy: false }),
    );

    expect(available).not.toBeDisabled();

    expectTrainingCalls(1);

    expect(navigation.navigate).toHaveBeenCalledTimes(1);
  });

  it("preserves completed workout navigation from the activity calendar", async () => {
    await mountHome();

    await screen.findByRole("button", {
      name: "Escolher treino",
    });

    await pressAction("Abrir treino do calendario");

    expect(navigation.navigate).toHaveBeenCalledTimes(1);

    expect(navigation.navigate).toHaveBeenCalledWith(
      "DetalhesHistoricoTreino",
      { workoutSessionId: "history-session-test" },
    );

    expectTrainingCalls(1);
  });

  it.each([true, false])(
    "accessibility: respects reducedMotion=%s in profile press feedback",
    async (reduceMotion) => {
      mockReduceMotion = reduceMotion;

      const loops = jest.spyOn(Animated, "loop").mockImplementation(() => ({
        start: jest.fn(),
        stop: jest.fn(),
        reset: jest.fn(),
      }));

      try {
        await mountHome();

        await screen.findByRole("button", {
          name: "Escolher treino",
        });

        const name = "Abrir meu perfil";
        const button = screen.getByRole("button", { name });

        expect(StyleSheet.flatten(button.props.style)?.opacity).not.toBe(0.76);

        let feedback;

        const user = userEvent.setup({
          advanceTimers: (delay) => {
            if (delay <= 0) return;

            const style = StyleSheet.flatten(
              screen.getByRole("button", { name }).props.style,
            );

            feedback = {
              opacity: style?.opacity,
              transform: style?.transform,
            };
          },
        });

        await user.press(button);

        expect(navigation.navigate.mock.calls).toEqual([["Perfil"]]);
        expectTrainingCalls(1);

        expect(feedback).toEqual({
          opacity: 0.76,
          transform: reduceMotion ? undefined : [{ scale: 0.96 }],
        });
      } finally {
        loops.mockRestore();
      }
    },
  );
});
