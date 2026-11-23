import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native";
import type { ComponentProps, ContextType } from "react";
import { AccessibilityInfo, Alert } from "react-native";

import { AuthContext } from "../../context/AuthContext";
import {
  getProfile,
  updateProfile,
  type UserProfile,
} from "../../services/profile";
import ProfileScreen from "../ProfileScreen";

jest.mock("../../context/AuthContext", () => {
  const React = jest.requireActual<typeof import("react")>("react");

  return {
    AuthContext: React.createContext(null),
  };
});

const mockSetPreference = jest.fn();

jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: () => ({
    theme: jest.requireActual("../../theme/themes").lightTheme,
    preference: "system",
    setPreference: mockSetPreference,
  }),
}));

jest.mock("../../components/ScreenGradient", () => () => null);

jest.mock("react-native-safe-area-context", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    SafeAreaView: ({
      children,
      style,
    }: {
      children: import("react").ReactNode;
      style?: import("react-native").StyleProp<
        import("react-native").ViewStyle
      >;
    }) => React.createElement(View, { style }, children),
  };
});

jest.mock("lucide-react-native", () => ({
  ChevronRight: () => null,
  Clock3: () => null,
  Dumbbell: () => null,
  Gauge: () => null,
  LogOut: () => null,
  Palette: () => null,
  Ruler: () => null,
  Target: () => null,
  UserRound: () => null,
}));

jest.mock("../../services/profile", () => ({
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
}));

const mockedGet = jest.mocked(getProfile);
const mockedUpdate = jest.mocked(updateProfile);

const TOKEN = "profile-test-token";
const NAME_LABEL = "Nome do perfil";
const SAVE_NAME = "Salvar nome";
const LOGOUT = "Sair da conta";
const LOADING = "Carregando perfil";
const RETRY = "Tentar carregar perfil novamente";

const profile: UserProfile = {
  id: "profile-test-user",
  name: "Ana Silva",
  email: "ana@example.com",
  createdAt: "2026-01-01T12:00:00Z",
  fitnessGoal: null,
  experienceLevel: null,
  weeklyWorkoutGoal: null,
  preferredWorkoutDurationMinutes: null,
  measurementSystem: null,
  heightCm: "175.00",
};

const updatedProfile: UserProfile = {
  ...profile,
  name: "Ana Souza",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;

  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });

  return { promise, resolve, reject };
}

async function mountProfile(
  overrides: Partial<NonNullable<ContextType<typeof AuthContext>>> = {},
) {
  const auth: NonNullable<ContextType<typeof AuthContext>> = {
    user: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      createdAt: profile.createdAt,
    },
    accessToken: TOKEN,
    loading: false,
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn().mockResolvedValue(undefined),
    refreshAccessToken: jest.fn(),
    runAuthenticatedRequest: (request) => request(TOKEN),
    updateAuthenticatedUser: jest.fn(),
    ...overrides,
  };

  await render(
    <AuthContext.Provider value={auth}>
      <ProfileScreen {...({} as ComponentProps<typeof ProfileScreen>)} />
    </AuthContext.Provider>,
  );

  return auth;
}

async function waitForProfile() {
  await screen.findByPlaceholderText("Seu nome");
}

function expectBusy(label: string, busy: boolean) {
  expect(screen.getByLabelText(label)).toHaveProp(
    "accessibilityState",
    expect.objectContaining({
      busy,
      disabled: busy,
    }),
  );
}

async function confirmLogout() {
  const calls = jest.mocked(Alert.alert).mock.calls;

  const confirmation = calls
    .find(([title]) => title === LOGOUT)?.[2]
    ?.find((button) => button.text === "Sair");

  expect(confirmation?.style).toBe("destructive");

  if (!confirmation?.onPress) {
    throw new Error("Logout confirmation action not found.");
  }

  const onPress = confirmation.onPress;

  await act(async () => {
    onPress();
  });
}

function getSelectorContainer(title: string) {
  const heading = screen.getByRole("header", { name: title });

  let container = heading.parent;

  while (container && container.props.accessibilityViewIsModal !== true) {
    container = container.parent;
  }

  if (!container) {
    throw new Error("Accessible selection modal not found.");
  }

  return container;
}

function expectSelector(
  title: string,
  options: readonly string[],
  selected: string | null,
) {
  const container = getSelectorContainer(title);
  const radios = within(container).getAllByRole("radio");

  expect(radios.map((radio) => radio.props.accessibilityLabel)).toEqual(
    options,
  );

  for (const label of options) {
    const option = within(container).getByRole("radio", {
      name: label,
    });

    expect(option).toHaveProp(
      "accessibilityState",
      expect.objectContaining({
        checked: label === selected,
      }),
    );

    expect(option).not.toBeDisabled();

    expect(option).toHaveStyle({
      minHeight: 48,
      minWidth: 48,
    });
  }

  const cancel = within(container).getByRole("button", {
    name: "Cancelar",
  });

  expect(cancel).not.toBeDisabled();

  expect(cancel).toHaveStyle({
    minHeight: 48,
    minWidth: 48,
  });

  return container;
}

async function chooseProfileOption(title: string, label: string) {
  const container = getSelectorContainer(title);

  await fireEvent.press(within(container).getByRole("radio", { name: label }));

  expect(screen.queryByRole("header", { name: title })).toBeNull();
}

describe("Profile screen accessibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockSetPreference.mockReset();
    mockSetPreference.mockResolvedValue(undefined);

    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(true);

    jest
      .spyOn(AccessibilityInfo, "addEventListener")
      .mockReturnValue({ remove: jest.fn() });

    mockedGet.mockReset();
    mockedGet.mockResolvedValue(profile);

    mockedUpdate.mockReset();
    mockedUpdate.mockResolvedValue(updatedProfile);

    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("preserves name validation and logout confirmation", async () => {
    const auth = await mountProfile();

    await waitForProfile();

    expect(mockedGet).toHaveBeenCalledWith(TOKEN);
    expect(mockedGet).toHaveBeenCalledTimes(1);

    expect(screen.getAllByText(profile.email)).toHaveLength(2);
    expect(screen.queryByText(SAVE_NAME)).toBeNull();

    await fireEvent.changeText(screen.getByPlaceholderText("Seu nome"), "   ");

    await fireEvent.press(screen.getByText(SAVE_NAME));

    expect(mockedUpdate).not.toHaveBeenCalled();

    expect(Alert.alert).toHaveBeenCalledWith(
      "Nome inv\u00e1lido",
      "Informe um nome para continuar.",
    );

    await fireEvent.press(screen.getByLabelText(LOGOUT));

    expect(auth.logout).not.toHaveBeenCalled();

    const call = jest
      .mocked(Alert.alert)
      .mock.calls.find(([title]) => title === LOGOUT);

    expect(call?.[2]?.find((button) => button.text === "Cancelar")?.style).toBe(
      "cancel",
    );

    expect(call?.[2]?.find((button) => button.text === "Sair")?.style).toBe(
      "destructive",
    );
  });

  it("accessibility: exposes loading, failure and retry states", async () => {
    const initial = deferred<UserProfile>();
    const retry = deferred<UserProfile>();

    mockedGet
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(retry.promise);

    await mountProfile();

    try {
      expect(screen.getByText("Carregando seu perfil")).toBeTruthy();

      expect(screen.getByLabelText(LOADING)).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ busy: true }),
      );

      expect(mockedGet).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => {
        initial.reject(new Error("Falha ao carregar perfil."));
      });
    }

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Falha ao carregar perfil.",
    );

    const retryButton = screen.getByLabelText(RETRY);

    expect(retryButton).toHaveStyle({ minHeight: 50 });

    try {
      await fireEvent.press(retryButton);

      expect(mockedGet).toHaveBeenCalledTimes(2);
      expect(mockedGet).toHaveBeenLastCalledWith(TOKEN);

      expect(screen.getByLabelText(LOADING)).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ busy: true }),
      );

      expect(screen.queryByLabelText(RETRY)).toBeNull();
      expect(screen.queryByText("Falha ao carregar perfil.")).toBeNull();
    } finally {
      await act(async () => {
        retry.resolve(profile);
      });
    }

    await waitForProfile();

    expect(screen.queryByLabelText(LOADING)).toBeNull();
    expect(screen.getByText(profile.name)).toBeTruthy();
    expect(screen.getAllByText(profile.email)).toHaveLength(2);
  });

  it("accessibility: keeps name saving identifiable and restores editing after failure", async () => {
    const request = deferred<UserProfile>();

    mockedUpdate.mockReturnValueOnce(request.promise);

    const auth = await mountProfile();

    await waitForProfile();

    const originalInput = screen.getByPlaceholderText("Seu nome");

    await fireEvent.changeText(originalInput, "  Ana   Souza  ");

    try {
      await fireEvent.press(screen.getByText(SAVE_NAME));

      expect(mockedUpdate).toHaveBeenCalledTimes(1);

      expect(mockedUpdate).toHaveBeenCalledWith(TOKEN, { name: "Ana Souza" });

      const field = screen.getByLabelText(NAME_LABEL);

      expect(field).toHaveProp("editable", false);

      expect(field).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ disabled: true }),
      );

      expectBusy(SAVE_NAME, true);

      expect(screen.getByLabelText(SAVE_NAME)).toBeDisabled();

      await fireEvent.press(screen.getByLabelText(SAVE_NAME));

      expect(mockedUpdate).toHaveBeenCalledTimes(1);
      expect(auth.updateAuthenticatedUser).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        if (mockedUpdate.mock.calls.length > 0) {
          request.reject(new Error("Falha ao salvar nome."));
        } else {
          request.resolve(profile);
        }
      });
    }

    expect(Alert.alert).toHaveBeenCalledWith(
      "N\u00e3o foi poss\u00edvel salvar",
      "Falha ao salvar nome.",
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Falha ao salvar nome.",
    );

    expect(screen.getByLabelText(NAME_LABEL)).toHaveProp("editable", true);

    expect(screen.getByLabelText(NAME_LABEL)).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ disabled: false }),
    );

    expect(screen.getByLabelText(NAME_LABEL)).toHaveProp(
      "value",
      "  Ana   Souza  ",
    );

    expectBusy(SAVE_NAME, false);

    expect(auth.updateAuthenticatedUser).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText(SAVE_NAME));

    expect(await screen.findByText("Ana Souza")).toBeTruthy();

    expect(mockedUpdate).toHaveBeenCalledTimes(2);
    expect(mockedUpdate).toHaveBeenLastCalledWith(TOKEN, { name: "Ana Souza" });

    expect(auth.updateAuthenticatedUser).toHaveBeenCalledTimes(1);

    expect(auth.updateAuthenticatedUser).toHaveBeenCalledWith({
      id: updatedProfile.id,
      name: updatedProfile.name,
      email: updatedProfile.email,
      createdAt: updatedProfile.createdAt,
    });

    expect(screen.getByLabelText(NAME_LABEL)).toHaveProp("value", "Ana Souza");

    expect(screen.queryByLabelText(SAVE_NAME)).toBeNull();
    expect(screen.queryByText("Falha ao salvar nome.")).toBeNull();
  });

  it("accessibility: provides a practical name saving touch target", async () => {
    await mountProfile();

    await waitForProfile();

    await fireEvent.changeText(
      screen.getByPlaceholderText("Seu nome"),
      "Ana Souza",
    );

    expect(screen.getByRole("button", { name: SAVE_NAME })).toHaveStyle({
      minHeight: 48,
    });
  });

  it("accessibility: exposes logout processing and restores the action after failure", async () => {
    const request = deferred<void>();

    const logout = jest
      .fn()
      .mockImplementationOnce(() => request.promise)
      .mockResolvedValue(undefined);

    await mountProfile({ logout });

    await waitForProfile();

    await fireEvent.press(screen.getByLabelText(LOGOUT));

    expect(logout).not.toHaveBeenCalled();

    try {
      await confirmLogout();

      expect(logout).toHaveBeenCalledTimes(1);

      expectBusy(LOGOUT, true);

      expect(screen.getByLabelText(LOGOUT)).toBeDisabled();
      expect(screen.getByLabelText(LOGOUT)).toHaveStyle({
        minHeight: 52,
      });

      await fireEvent.press(screen.getByLabelText(LOGOUT));

      expect(logout).toHaveBeenCalledTimes(1);

      expect(Alert.alert).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => {
        if (logout.mock.calls.length > 0) {
          request.reject(new Error("Falha ao sair."));
        } else {
          request.resolve(undefined);
        }
      });
    }

    expect(Alert.alert).toHaveBeenCalledWith(
      "N\u00e3o foi poss\u00edvel sair",
      "Falha ao sair.",
    );

    expectBusy(LOGOUT, false);

    expect(screen.getByLabelText(LOGOUT)).not.toBeDisabled();
    expect(screen.getByText(profile.name)).toBeTruthy();

    jest.mocked(Alert.alert).mockClear();

    await fireEvent.press(screen.getByLabelText(LOGOUT));

    await confirmLogout();

    expect(logout).toHaveBeenCalledTimes(2);
  });

  it("accessibility: identifies the current sports preferences and complete profile", async () => {
    const completeProfile: UserProfile = {
      ...profile,
      fitnessGoal: "strength",
      experienceLevel: "intermediate",
      weeklyWorkoutGoal: 3,
      preferredWorkoutDurationMinutes: 45,
      measurementSystem: "metric",
    };

    mockedGet.mockResolvedValueOnce(completeProfile);

    await mountProfile();

    await waitForProfile();

    const labels = [
      "Objetivo principal: Aumentar for\u00e7a",
      "Experi\u00eancia: Intermedi\u00e1rio",
      "Meta semanal: 3 treinos por semana",
      "Dura\u00e7\u00e3o preferida: 45 minutos",
      "Unidades: M\u00e9trico \u2014 kg / km",
    ];

    for (const label of labels) {
      const button = screen.getByRole("button", { name: label });

      expect(button).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ disabled: false }),
      );

      expect(button).not.toBeDisabled();

      expect(button).toHaveStyle({ minHeight: 76 });
    }

    expect(
      screen.getByRole("progressbar", {
        name: "Completude do perfil de treino",
      }),
    ).toHaveProp(
      "accessibilityValue",
      expect.objectContaining({
        min: 0,
        max: 100,
        now: 100,
        text: "5 de 5 prefer\u00eancias configuradas, 100%",
      }),
    );

    expect(screen.getByText("100% configurado")).toBeTruthy();

    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("accessibility: disables sports preferences during an update and restores them after failure", async () => {
    const request = deferred<UserProfile>();

    mockedUpdate.mockReturnValueOnce(request.promise);

    const auth = await mountProfile();

    await waitForProfile();

    const labels = [
      "Objetivo principal: N\u00e3o definido",
      "Experi\u00eancia: N\u00e3o definido",
      "Meta semanal: N\u00e3o definido",
      "Dura\u00e7\u00e3o preferida: N\u00e3o definido",
      "Unidades: N\u00e3o definido",
    ];

    await fireEvent.press(screen.getByText("Objetivo principal"));

    try {
      await chooseProfileOption("Objetivo principal", "Aumentar for\u00e7a");

      expect(mockedUpdate).toHaveBeenCalledTimes(1);

      expect(mockedUpdate).toHaveBeenCalledWith(TOKEN, {
        fitnessGoal: "strength",
      });

      for (const label of labels) {
        const button = screen.getByRole("button", { name: label });

        expect(button).toHaveProp(
          "accessibilityState",
          expect.objectContaining({ disabled: true }),
        );

        expect(button).toBeDisabled();

        await fireEvent.press(button);
      }

      expect(Alert.alert).not.toHaveBeenCalled();

      expect(mockedUpdate).toHaveBeenCalledTimes(1);

      expect(auth.updateAuthenticatedUser).not.toHaveBeenCalled();

      expect(
        screen.getByRole("button", {
          name: "Apar\u00eancia: Seguir sistema",
        }),
      ).not.toBeDisabled();
    } finally {
      await act(async () => {
        if (mockedUpdate.mock.calls.length > 0) {
          request.reject(new Error("Falha ao atualizar preferencia."));
        } else {
          request.resolve(profile);
        }
      });
    }

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Falha ao atualizar preferencia.",
    );

    for (const label of labels) {
      const button = screen.getByRole("button", { name: label });

      expect(button).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ disabled: false }),
      );

      expect(button).not.toBeDisabled();
    }

    expect(auth.updateAuthenticatedUser).not.toHaveBeenCalled();

    jest.mocked(Alert.alert).mockClear();

    await fireEvent.press(
      screen.getByRole("button", {
        name: labels[0],
      }),
    );

    expect(Alert.alert).not.toHaveBeenCalled();

    expect(
      screen.getByRole("header", { name: "Objetivo principal" }),
    ).toBeTruthy();

    expect(mockedUpdate).toHaveBeenCalledTimes(1);
  });

  it("accessibility: updates the profile completion value after a successful preference change", async () => {
    const updatedGoal: UserProfile = {
      ...profile,
      fitnessGoal: "muscle_gain",
    };

    mockedUpdate.mockResolvedValueOnce(updatedGoal);

    const auth = await mountProfile();

    await waitForProfile();

    function expectCompletion(count: number, percentage: number) {
      expect(
        screen.getByRole("progressbar", {
          name: "Completude do perfil de treino",
        }),
      ).toHaveProp(
        "accessibilityValue",
        expect.objectContaining({
          min: 0,
          max: 100,
          now: percentage,
          text: `${count} de 5 prefer\u00eancias configuradas, ${percentage}%`,
        }),
      );
    }

    expectCompletion(0, 0);

    expect(screen.getByText("0% configurado")).toBeTruthy();

    await fireEvent.press(
      screen.getByRole("button", {
        name: "Objetivo principal: N\u00e3o definido",
      }),
    );

    await chooseProfileOption("Objetivo principal", "Ganhar massa muscular");

    expect(
      await screen.findByRole("button", {
        name: "Objetivo principal: Ganhar massa muscular",
      }),
    ).toBeTruthy();

    expect(mockedUpdate).toHaveBeenCalledTimes(1);

    expect(mockedUpdate).toHaveBeenCalledWith(TOKEN, {
      fitnessGoal: "muscle_gain",
    });

    expect(auth.updateAuthenticatedUser).toHaveBeenCalledTimes(1);

    expectCompletion(1, 20);

    expect(screen.getByText("20% configurado")).toBeTruthy();
    expect(screen.queryByText("0% configurado")).toBeNull();
  });

  it("accessibility: identifies appearance and preserves local theme selection", async () => {
    await mountProfile();

    await waitForProfile();

    const appearance = screen.getByRole("button", {
      name: "Apar\u00eancia: Seguir sistema",
    });

    expect(appearance).not.toBeDisabled();

    expect(appearance).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ disabled: false }),
    );

    expect(appearance).toHaveStyle({ minHeight: 76 });

    await fireEvent.press(appearance);

    expectSelector(
      "Apar\u00eancia",
      ["Claro", "Escuro", "Seguir sistema"],
      "Seguir sistema",
    );

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockSetPreference).not.toHaveBeenCalled();
    expect(mockedUpdate).not.toHaveBeenCalled();

    await chooseProfileOption("Apar\u00eancia", "Escuro");

    expect(mockSetPreference).toHaveBeenCalledTimes(1);
    expect(mockSetPreference).toHaveBeenCalledWith("dark");

    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  const configuredProfile: UserProfile = {
    ...profile,
    fitnessGoal: "strength",
    experienceLevel: "intermediate",
    weeklyWorkoutGoal: 3,
    preferredWorkoutDurationMinutes: 45,
    measurementSystem: "metric",
  };

  it.each([
    {
      row: "Objetivo principal: Aumentar for\u00e7a",
      title: "Objetivo principal",
      options: [
        "Ganhar massa muscular",
        "Aumentar for\u00e7a",
        "Condicionamento geral",
        "Melhorar resist\u00eancia",
        "Reduzir gordura corporal",
      ],
      selected: "Aumentar for\u00e7a",
      choice: "Reduzir gordura corporal",
      patch: { fitnessGoal: "fat_loss" },
      updatedRow: "Objetivo principal: Reduzir gordura corporal",
    },
    {
      row: "Experi\u00eancia: Intermedi\u00e1rio",
      title: "N\u00edvel de experi\u00eancia",
      options: ["Iniciante", "Intermedi\u00e1rio", "Avan\u00e7ado"],
      selected: "Intermedi\u00e1rio",
      choice: "Avan\u00e7ado",
      patch: { experienceLevel: "advanced" },
      updatedRow: "Experi\u00eancia: Avan\u00e7ado",
    },
    {
      row: "Meta semanal: 3 treinos por semana",
      title: "Meta semanal",
      options: [
        "1 treino por semana",
        "2 treinos por semana",
        "3 treinos por semana",
        "4 treinos por semana",
        "5 treinos por semana",
        "6 treinos por semana",
        "7 treinos por semana",
      ],
      selected: "3 treinos por semana",
      choice: "7 treinos por semana",
      patch: { weeklyWorkoutGoal: 7 },
      updatedRow: "Meta semanal: 7 treinos por semana",
    },
    {
      row: "Dura\u00e7\u00e3o preferida: 45 minutos",
      title: "Dura\u00e7\u00e3o preferida",
      options: [
        "15 minutos",
        "30 minutos",
        "45 minutos",
        "60 minutos",
        "75 minutos",
        "90 minutos",
        "120 minutos",
        "150 minutos",
        "180 minutos",
      ],
      selected: "45 minutos",
      choice: "180 minutos",
      patch: { preferredWorkoutDurationMinutes: 180 },
      updatedRow: "Dura\u00e7\u00e3o preferida: 180 minutos",
    },
    {
      row: "Unidades: M\u00e9trico \u2014 kg / km",
      title: "Sistema de unidades",
      options: ["M\u00e9trico \u2014 kg / km", "Imperial \u2014 lb / mi"],
      selected: "M\u00e9trico \u2014 kg / km",
      choice: "Imperial \u2014 lb / mi",
      patch: { measurementSystem: "imperial" },
      updatedRow: "Unidades: Imperial \u2014 lb / mi",
    },
  ] as const)(
    "accessibility: exposes every $title option and preserves persistence",
    async ({ row, title, options, selected, choice, patch, updatedRow }) => {
      mockedGet.mockResolvedValueOnce(configuredProfile);

      mockedUpdate.mockResolvedValueOnce({
        ...configuredProfile,
        ...patch,
      });

      const auth = await mountProfile();

      await waitForProfile();

      await fireEvent.press(screen.getByRole("button", { name: row }));

      const container = expectSelector(title, options, selected);

      expect(Alert.alert).not.toHaveBeenCalled();
      expect(mockedUpdate).not.toHaveBeenCalled();

      await fireEvent.press(
        within(container).getByRole("button", {
          name: "Cancelar",
        }),
      );

      expect(screen.queryByRole("header", { name: title })).toBeNull();

      expect(mockedUpdate).not.toHaveBeenCalled();
      expect(mockSetPreference).not.toHaveBeenCalled();

      await fireEvent.press(screen.getByRole("button", { name: row }));

      expectSelector(title, options, selected);

      await chooseProfileOption(title, choice);

      expect(
        await screen.findByRole("button", {
          name: updatedRow,
        }),
      ).toBeTruthy();

      expect(mockedUpdate).toHaveBeenCalledTimes(1);
      expect(mockedUpdate).toHaveBeenCalledWith(TOKEN, patch);

      expect(auth.updateAuthenticatedUser).toHaveBeenCalledTimes(1);
      expect(mockSetPreference).not.toHaveBeenCalled();

      await fireEvent.press(screen.getByRole("button", { name: updatedRow }));

      expectSelector(title, options, choice);

      expect(mockedUpdate).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["requestClose", "accessibilityEscape"] as const)(
    "accessibility: cancels a selector through %s without persisting",
    async (event) => {
      await mountProfile();

      await waitForProfile();

      const row = "Apar\u00eancia: Seguir sistema";
      const title = "Apar\u00eancia";

      await fireEvent.press(screen.getByRole("button", { name: row }));

      const container = expectSelector(
        title,
        ["Claro", "Escuro", "Seguir sistema"],
        "Seguir sistema",
      );

      if (event === "accessibilityEscape") {
        expect(container).toHaveProp(
          "onAccessibilityEscape",
          expect.any(Function),
        );

        await fireEvent(container, "accessibilityEscape");
      } else {
        let modal = container.parent;

        while (modal && typeof modal.props.onRequestClose !== "function") {
          modal = modal.parent;
        }

        if (!modal) {
          throw new Error("Native modal close handler not found.");
        }

        const close = modal.props.onRequestClose;

        await act(async () => {
          close();
        });
      }

      expect(screen.queryByRole("header", { name: title })).toBeNull();

      expect(mockSetPreference).not.toHaveBeenCalled();
      expect(mockedUpdate).not.toHaveBeenCalled();

      await fireEvent.press(screen.getByRole("button", { name: row }));

      expectSelector(
        title,
        ["Claro", "Escuro", "Seguir sistema"],
        "Seguir sistema",
      );
    },
  );

  it("accessibility: prevents concurrent theme writes and restores selection after failure", async () => {
    const request = deferred<void>();

    mockSetPreference
      .mockReturnValueOnce(request.promise)
      .mockResolvedValueOnce(undefined);

    await mountProfile();

    await waitForProfile();

    const row = "Apar\u00eancia: Seguir sistema";
    const title = "Apar\u00eancia";

    await fireEvent.press(screen.getByRole("button", { name: row }));

    try {
      await chooseProfileOption(title, "Escuro");

      expect(mockSetPreference).toHaveBeenCalledTimes(1);
      expect(mockSetPreference).toHaveBeenCalledWith("dark");

      const appearance = screen.getByRole("button", {
        name: row,
      });

      expect(appearance).toBeDisabled();

      expect(appearance).toHaveProp(
        "accessibilityState",
        expect.objectContaining({
          busy: true,
          disabled: true,
        }),
      );

      await fireEvent.press(appearance);

      expect(screen.queryByRole("header", { name: title })).toBeNull();

      expect(mockSetPreference).toHaveBeenCalledTimes(1);

      expect(
        screen.getByRole("button", {
          name: "Objetivo principal: N\u00e3o definido",
        }),
      ).not.toBeDisabled();

      expect(mockedUpdate).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        if (mockSetPreference.mock.calls.length > 0) {
          request.reject(new Error("Falha ao salvar tema."));
        } else {
          request.resolve(undefined);
        }
      });
    }

    expect(Alert.alert).toHaveBeenCalledWith(
      "N\u00e3o foi poss\u00edvel alterar a apar\u00eancia",
      "Falha ao salvar tema.",
    );

    expect(screen.getByRole("button", { name: row })).not.toBeDisabled();

    await fireEvent.press(screen.getByRole("button", { name: row }));

    await chooseProfileOption(title, "Claro");

    expect(mockSetPreference.mock.calls).toEqual([["dark"], ["light"]]);

    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });

  it("accessibility: hides background controls while a selector is open and restores them after dismissal", async () => {
    await mountProfile();
    await waitForProfile();

    const row = "Apar\u00eancia: Seguir sistema";
    const title = "Apar\u00eancia";

    expect(screen.getByRole("button", { name: LOGOUT })).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: row }));

    const container = expectSelector(
      title,
      ["Claro", "Escuro", "Seguir sistema"],
      "Seguir sistema",
    );

    expect(screen.queryByRole("button", { name: LOGOUT })).toBeNull();

    expect(screen.queryByLabelText(NAME_LABEL)).toBeNull();

    expect(screen.queryByRole("button", { name: row })).toBeNull();

    await fireEvent.press(
      within(container).getByRole("button", {
        name: "Cancelar",
      }),
    );

    expect(screen.queryByRole("header", { name: title })).toBeNull();

    expect(screen.getByRole("button", { name: LOGOUT })).not.toBeDisabled();

    expect(screen.getByLabelText(NAME_LABEL)).toHaveProp("editable", true);

    expect(screen.getByRole("button", { name: row })).not.toBeDisabled();

    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(mockSetPreference).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
