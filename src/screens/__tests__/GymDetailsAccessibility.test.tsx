import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import type { ComponentProps, ContextType } from "react";
import {
  AccessibilityInfo,
  Linking,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { AuthContext } from "../../context/AuthContext";
import {
  addFavoriteGym,
  getFavoriteGyms,
  getGymDetails,
  removeFavoriteGym,
  type FavoriteGym,
  type GymDetails,
} from "../../services/gyms";
import GymDetailsScreen from "../GymDetailsScreen";

jest.mock("../../config/environment", () => ({
  environment: {
    apiUrl: "http://127.0.0.1:8000/api/v1",
  },
}));

jest.mock("../../context/AuthContext", () => {
  const React = jest.requireActual<typeof import("react")>("react");

  return {
    AuthContext: React.createContext(null),
  };
});

jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: () => ({
    theme: jest.requireActual("../../theme/themes").lightTheme,
  }),
}));

jest.mock("lucide-react-native", () => ({
  AlertCircle: () => null,
  ArrowLeft: () => null,
  ArrowRight: () => null,
  Check: () => null,
  Clock3: () => null,
  Dumbbell: () => null,
  ExternalLink: () => null,
  Globe2: () => null,
  Heart: () => null,
  Images: () => null,
  MapPin: () => null,
  Navigation: () => null,
  Phone: () => null,
  ShieldCheck: () => null,
}));

jest.mock("../../services/gyms", () => ({
  addFavoriteGym: jest.fn(),
  getFavoriteGyms: jest.fn(),
  getGymDetails: jest.fn(),
  removeFavoriteGym: jest.fn(),
}));

jest.mock("../GymReviewsSection", () => ({
  __esModule: true,
  default: () => null,
}));

const mockedDetails = jest.mocked(getGymDetails);
const mockedFavorites = jest.mocked(getFavoriteGyms);
const mockedAdd = jest.mocked(addFavoriteGym);
const mockedRemove = jest.mocked(removeFavoriteGym);

const TOKEN = "test-access-token";
const EXTERNAL_ID = "gym-external-test";
const INTERNAL_ID = "gym-internal-test";

const ADD_LABEL = "Adicionar academia aos favoritos";
const REMOVE_LABEL = "Remover academia dos favoritos";
const SYNC_LABEL = "Sincronizando favorito";
const RETRY_LABEL = "Tentar sincronizar favorito novamente";

const FAVORITE_ERROR =
  "N\u00e3o foi poss\u00edvel atualizar o favorito desta academia.";

const gym: GymDetails = {
  id: EXTERNAL_ID,
  providerName: "tomtom",
  name: "Academia Aurora",
  address: "Rua das Flores, 100",
  coordinates: {
    latitude: -22.471,
    longitude: -43.825,
  },
  phone: "(24) 99999-1234",
  website: "academia.example.com",
  openingHours: null,
  imageUrls: [],
  amenities: [],
};

const favorite: FavoriteGym = {
  id: "favorite-test",
  gymId: INTERNAL_ID,
  externalId: EXTERNAL_ID,
  providerName: "tomtom",
  name: gym.name,
  address: gym.address,
  coordinates: gym.coordinates,
  favoritedAt: "2026-11-18T12:00:00Z",
};

const authValue: NonNullable<ContextType<typeof AuthContext>> = {
  user: null,
  accessToken: TOKEN,
  loading: false,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  refreshAccessToken: jest.fn(),
  runAuthenticatedRequest: (request) => request(TOKEN),
  updateAuthenticatedUser: jest.fn(),
};

const navigation = {
  goBack: jest.fn(),
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;

  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

async function renderDetails(waitForGym = true): Promise<void> {
  await render(
    <AuthContext.Provider value={authValue}>
      <GymDetailsScreen
        navigation={
          navigation as unknown as ComponentProps<
            typeof GymDetailsScreen
          >["navigation"]
        }
        route={{
          key: "gym-details-accessibility-test",
          name: "DetalhesAcademia",
          params: {
            gymId: EXTERNAL_ID,
            providerName: "tomtom",
            distanceKm: null,
          },
        }}
      />
    </AuthContext.Provider>,
  );

  if (waitForGym) {
    await screen.findByText(gym.name);
  }
}

async function waitForReady(label: string): Promise<void> {
  await waitFor(() => {
    expect(screen.getByLabelText(label)).not.toBeDisabled();
  });
}

function assertFavoriteState(
  label: string,
  busy: boolean,
  disabled: boolean,
): void {
  expect(screen.getByLabelText(label)).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ busy, disabled }),
  );
}

async function pressAndReadFeedback(name: string, opacity: number) {
  const button = screen.getByRole("button", { name });

  const initial = StyleSheet.flatten(
    button.props.style as StyleProp<ViewStyle>,
  );

  expect(initial?.opacity).not.toBe(opacity);

  let feedback: Pick<ViewStyle, "opacity" | "transform"> | undefined;

  const user = userEvent.setup({
    advanceTimers: (delay) => {
      if (delay <= 0) return;

      const style = StyleSheet.flatten(
        screen.getByRole("button", { name }).props
          .style as StyleProp<ViewStyle>,
      );

      feedback = {
        opacity: style?.opacity,
        transform: style?.transform,
      };
    },
  });

  await user.press(button);

  if (!feedback) {
    throw new Error("Pressed feedback was not observed.");
  }

  return feedback;
}

function expectedFeedback(
  reduceMotion: boolean,
  opacity: number,
  scale: number,
) {
  return {
    opacity,
    transform: reduceMotion ? undefined : [{ scale }],
  };
}

describe("GymDetailsScreen - accessibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(true);

    jest
      .spyOn(AccessibilityInfo, "addEventListener")
      .mockReturnValue({ remove: jest.fn() });

    mockedDetails.mockReset();
    mockedFavorites.mockReset();
    mockedAdd.mockReset();
    mockedRemove.mockReset();

    mockedDetails.mockResolvedValue(gym);
    mockedFavorites.mockResolvedValue([]);
    mockedAdd.mockResolvedValue(favorite);
    mockedRemove.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("accessibility: keeps long gym address and website readable", async () => {
    const address =
      "Avenida das Flores, 1234, bloco B, segundo andar, bairro Jardim Central";

    const website =
      "https://academia.example.com/unidades/jardim-central/informacoes";

    mockedDetails.mockResolvedValueOnce({
      ...gym,
      address,
      website,
    });

    await renderDetails();
    await waitForReady(ADD_LABEL);

    const addresses = screen.getAllByText(address);

    expect(addresses).toHaveLength(2);

    for (const addressText of addresses) {
      expect(addressText.props.numberOfLines).toBeUndefined();
    }

    expect(screen.getByText(website).props.numberOfLines).toBeUndefined();

    expect(screen.getByLabelText("Abrir site da academia")).not.toBeDisabled();
  });

  it("preserves gym details, external actions and map navigation", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);

    await renderDetails();
    await waitForReady(ADD_LABEL);

    expect(mockedDetails).toHaveBeenCalledWith(EXTERNAL_ID, "tomtom");

    expect(mockedFavorites).toHaveBeenCalledWith(TOKEN);

    expect(screen.getByText(gym.name)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Abrir rota para a academia"));

    expect(openURL).toHaveBeenCalledWith(
      "https://www.google.com/maps/dir/?api=1&destination=-22.471%2C-43.825",
    );

    await fireEvent.press(screen.getByLabelText("Ligar para a academia"));

    expect(openURL).toHaveBeenCalledWith("tel:24999991234");

    await fireEvent.press(screen.getByLabelText("Abrir site da academia"));

    expect(openURL).toHaveBeenCalledWith("https://academia.example.com");

    await fireEvent.press(screen.getByLabelText("Voltar ao mapa"));

    expect(navigation.goBack).toHaveBeenCalledTimes(1);

    expect(openURL).toHaveBeenCalledTimes(3);
    expect(mockedAdd).not.toHaveBeenCalled();
    expect(mockedRemove).not.toHaveBeenCalled();
  });

  it("preserves favorite identity across providers", async () => {
    mockedFavorites.mockResolvedValueOnce([
      {
        ...favorite,
        id: "another-provider-favorite",
        gymId: "another-provider-internal",
        providerName: "geoapify",
      },
    ]);

    await renderDetails();
    await waitForReady(ADD_LABEL);

    expect(screen.queryByLabelText(REMOVE_LABEL)).toBeNull();

    await fireEvent.press(screen.getByLabelText(ADD_LABEL));

    await waitForReady(REMOVE_LABEL);

    expect(mockedAdd).toHaveBeenCalledWith(TOKEN, EXTERNAL_ID, "tomtom");

    expect(mockedAdd).toHaveBeenCalledTimes(1);
    expect(mockedRemove).not.toHaveBeenCalled();

    expect(screen.getByText("Favorita")).toBeTruthy();
  });

  it("exposes favorite synchronization while the initial request is pending", async () => {
    const pending = deferred<FavoriteGym[]>();

    mockedFavorites.mockReturnValueOnce(pending.promise);

    await renderDetails();

    try {
      assertFavoriteState(SYNC_LABEL, true, true);

      expect(screen.getByLabelText(SYNC_LABEL)).toBeDisabled();

      expect(mockedFavorites).toHaveBeenCalledTimes(1);
      expect(mockedAdd).not.toHaveBeenCalled();
      expect(mockedRemove).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        pending.resolve([favorite]);
      });
    }

    await waitForReady(REMOVE_LABEL);

    assertFavoriteState(REMOVE_LABEL, false, false);

    expect(screen.getByText("Favorita")).toBeTruthy();
  });

  it("exposes pending addition and recovers after a favorite request fails", async () => {
    const pending = deferred<FavoriteGym>();

    mockedAdd.mockReturnValueOnce(pending.promise);

    await renderDetails();
    await waitForReady(ADD_LABEL);

    await fireEvent.press(screen.getByLabelText(ADD_LABEL));

    try {
      assertFavoriteState(ADD_LABEL, true, true);

      expect(screen.getByLabelText(ADD_LABEL)).toBeDisabled();

      expect(mockedAdd).toHaveBeenCalledWith(TOKEN, EXTERNAL_ID, "tomtom");

      expect(mockedAdd).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => {
        pending.reject(new Error("Test favorite failure"));
      });
    }

    expect(await screen.findByText(FAVORITE_ERROR)).toBeTruthy();

    await waitForReady(ADD_LABEL);

    assertFavoriteState(ADD_LABEL, false, false);

    expect(screen.queryByLabelText(REMOVE_LABEL)).toBeNull();

    await fireEvent.press(screen.getByLabelText(ADD_LABEL));

    await waitForReady(REMOVE_LABEL);

    assertFavoriteState(REMOVE_LABEL, false, false);

    expect(mockedAdd).toHaveBeenCalledTimes(2);

    expect(screen.queryByText(FAVORITE_ERROR)).toBeNull();

    expect(screen.getByText("Favorita")).toBeTruthy();
  });

  it("exposes pending removal and preserves the internal favorite identity", async () => {
    const pending = deferred<void>();

    mockedFavorites.mockResolvedValueOnce([favorite]);
    mockedRemove.mockReturnValueOnce(pending.promise);

    await renderDetails();
    await waitForReady(REMOVE_LABEL);

    await fireEvent.press(screen.getByLabelText(REMOVE_LABEL));

    try {
      assertFavoriteState(REMOVE_LABEL, true, true);

      expect(screen.getByLabelText(REMOVE_LABEL)).toBeDisabled();

      expect(mockedRemove).toHaveBeenCalledWith(TOKEN, INTERNAL_ID);

      expect(mockedRemove).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => {
        pending.resolve(undefined);
      });
    }

    await waitForReady(ADD_LABEL);

    assertFavoriteState(ADD_LABEL, false, false);

    expect(screen.queryByText("Favorita")).toBeNull();
    expect(mockedAdd).not.toHaveBeenCalled();
  });

  it("keeps favorite actions disabled after synchronization failure and supports accessible retry", async () => {
    mockedFavorites.mockRejectedValueOnce(
      new Error("Test synchronization failure"),
    );

    const pending = deferred<FavoriteGym[]>();

    mockedFavorites.mockReturnValueOnce(pending.promise);

    await renderDetails();

    await screen.findByText(FAVORITE_ERROR);

    assertFavoriteState(ADD_LABEL, false, true);

    expect(screen.getByLabelText(ADD_LABEL)).toBeDisabled();

    const retry = screen.getByLabelText(RETRY_LABEL);

    expect(retry).toHaveStyle({
      minHeight: 48,
      minWidth: 48,
    });

    await fireEvent.press(retry);

    try {
      assertFavoriteState(SYNC_LABEL, true, true);

      expect(screen.queryByLabelText(RETRY_LABEL)).toBeNull();

      expect(mockedFavorites).toHaveBeenCalledTimes(2);
    } finally {
      await act(async () => {
        pending.resolve([]);
      });
    }

    await waitForReady(ADD_LABEL);

    assertFavoriteState(ADD_LABEL, false, false);

    expect(screen.queryByText(FAVORITE_ERROR)).toBeNull();
    expect(mockedAdd).not.toHaveBeenCalled();
    expect(mockedRemove).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "accessibility: respects reducedMotion=%s in gym detail actions",
    async (reduceMotion) => {
      jest
        .mocked(AccessibilityInfo.isReduceMotionEnabled)
        .mockResolvedValue(reduceMotion);

      const openURL = jest
        .spyOn(Linking, "openURL")
        .mockResolvedValue(undefined);

      await renderDetails();
      await waitForReady(ADD_LABEL);

      const route = await pressAndReadFeedback(
        "Abrir rota para a academia",
        0.86,
      );

      const phone = await pressAndReadFeedback("Ligar para a academia", 0.72);

      const website = await pressAndReadFeedback(
        "Abrir site da academia",
        0.72,
      );

      const add = await pressAndReadFeedback(ADD_LABEL, 0.86);

      await waitForReady(REMOVE_LABEL);

      const remove = await pressAndReadFeedback(REMOVE_LABEL, 0.86);

      await waitForReady(ADD_LABEL);

      const back = await pressAndReadFeedback("Voltar ao mapa", 0.72);

      expect(openURL.mock.calls).toEqual([
        [
          "https://www.google.com/maps/dir/?api=1&destination=-22.471%2C-43.825",
        ],
        ["tel:24999991234"],
        ["https://academia.example.com"],
      ]);

      expect(mockedAdd).toHaveBeenCalledTimes(1);
      expect(mockedAdd).toHaveBeenCalledWith(TOKEN, EXTERNAL_ID, "tomtom");

      expect(mockedRemove).toHaveBeenCalledTimes(1);
      expect(mockedRemove).toHaveBeenCalledWith(TOKEN, INTERNAL_ID);

      expect(navigation.goBack).toHaveBeenCalledTimes(1);

      expect(mockedDetails).toHaveBeenCalledTimes(1);

      const primary = expectedFeedback(reduceMotion, 0.86, 0.985);
      const secondary = expectedFeedback(reduceMotion, 0.72, 0.98);

      expect({ route, phone, website, add, remove, back }).toEqual({
        route: primary,
        phone: secondary,
        website: secondary,
        add: primary,
        remove: primary,
        back: secondary,
      });
    },
  );

  it.each([true, false])(
    "accessibility: respects reducedMotion=%s in favorite retry feedback",
    async (reduceMotion) => {
      jest
        .mocked(AccessibilityInfo.isReduceMotionEnabled)
        .mockResolvedValue(reduceMotion);

      mockedFavorites.mockRejectedValueOnce(
        new Error("Test synchronization failure"),
      );

      await renderDetails();
      await screen.findByText(FAVORITE_ERROR);

      expect(screen.getByLabelText(ADD_LABEL)).toBeDisabled();

      const feedback = await pressAndReadFeedback(RETRY_LABEL, 0.72);

      await waitForReady(ADD_LABEL);

      expect(mockedFavorites).toHaveBeenCalledTimes(2);
      expect(mockedAdd).not.toHaveBeenCalled();
      expect(mockedRemove).not.toHaveBeenCalled();

      expect(feedback).toEqual(expectedFeedback(reduceMotion, 0.72, 0.98));
    },
  );

  it.each([true, false])(
    "accessibility: respects reducedMotion=%s in error navigation feedback",
    async (reduceMotion) => {
      jest
        .mocked(AccessibilityInfo.isReduceMotionEnabled)
        .mockResolvedValue(reduceMotion);

      mockedDetails.mockRejectedValueOnce(
        new Error("Test gym loading failure"),
      );

      await renderDetails(false);

      await screen.findByRole("button", {
        name: "Voltar ao mapa",
      });

      const feedback = await pressAndReadFeedback("Voltar ao mapa", 0.86);

      expect(navigation.goBack).toHaveBeenCalledTimes(1);
      expect(mockedAdd).not.toHaveBeenCalled();
      expect(mockedRemove).not.toHaveBeenCalled();

      expect(feedback).toEqual(expectedFeedback(reduceMotion, 0.86, 0.985));
    },
  );
});
