import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import { AccessibilityInfo, Animated, Text } from "react-native";

import { useReducedMotion } from "../../hooks/useReducedMotion";
import { lightSurfaceDepth, lightMetricDetail } from "../../theme/surfaces";
import { darkTheme, lightTheme } from "../../theme/themes";
import MotionPressable from "../MotionPressable";
import MotionScrollView from "../MotionScrollView";
import ScreenGradient from "../ScreenGradient";

jest.mock("@react-navigation/native", () => {
  const React = jest.requireActual<typeof import("react")>("react");

  return {
    useFocusEffect: (callback: () => void | (() => void)) =>
      React.useEffect(callback, [callback]),
  };
});

jest.mock("expo-linear-gradient", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    LinearGradient: () =>
      React.createElement(View, {
        testID: "screen-gradient",
      }),
  };
});

function MotionPreferenceProbe() {
  const reduceMotion = useReducedMotion();

  return <Text>{reduceMotion ? "reduced" : "enabled"}</Text>;
}

describe("Orange Fusion visual and motion", () => {
  const remove = jest.fn();

  beforeEach(() => {
    remove.mockClear();

    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(true);

    jest
      .spyOn(AccessibilityInfo, "addEventListener")
      .mockReturnValue({ remove });

    jest.spyOn(Animated, "timing").mockImplementation(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      reset: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the gradient only in light mode", async () => {
    const view = await render(<ScreenGradient theme={lightTheme} />);

    expect(
      screen.getByTestId("screen-gradient", { includeHiddenElements: true }),
    ).toBeTruthy();

    await view.rerender(<ScreenGradient theme={darkTheme} />);

    expect(
      screen.queryByTestId("screen-gradient", { includeHiddenElements: true }),
    ).toBeNull();
  });

  it("applies surface depth without changing dark mode", () => {
    expect(lightSurfaceDepth(lightTheme, "featured")).toMatchObject({
      elevation: 4,
      shadowOpacity: 0.15,
    });

    expect(lightMetricDetail(lightTheme)).toMatchObject({
      borderTopWidth: 2,
    });

    expect(lightSurfaceDepth(darkTheme, "featured")).toEqual({});
    expect(lightMetricDetail(darkTheme)).toEqual({});
  });

  it("updates the motion preference and removes its listener", async () => {
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockResolvedValue(false);

    const view = await render(<MotionPreferenceProbe />);

    await waitFor(() => {
      expect(screen.getByText("enabled")).toBeTruthy();
    });

    const listener = jest.mocked(AccessibilityInfo.addEventListener).mock
      .calls[0][1] as (enabled: boolean) => void;

    await act(async () => {
      listener(true);
    });

    expect(screen.getByText("reduced")).toBeTruthy();

    await view.unmount();

    expect(remove).toHaveBeenCalled();
  });

  it("keeps motion reduced when preference detection fails", async () => {
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockRejectedValue(new Error("Unavailable"));

    await render(<MotionPreferenceProbe />);

    expect(screen.getByText("reduced")).toBeTruthy();
  });

  it("animates press feedback and preserves the press action", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();

    await render(
      <MotionPressable
        reduceMotion={false}
        accessibilityRole="button"
        accessibilityLabel="Open workout"
        onPress={onPress}
      >
        <Text>Workout</Text>
      </MotionPressable>,
    );

    await user.press(
      screen.getByRole("button", {
        name: "Open workout",
      }),
    );

    expect(onPress).toHaveBeenCalledTimes(1);

    expect(Animated.timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        toValue: 0.975,
        useNativeDriver: true,
      }),
    );

    expect(Animated.timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        toValue: 1,
        useNativeDriver: true,
      }),
    );
  });

  it("preserves the press action without reduced-motion animation", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();

    await render(
      <MotionPressable
        reduceMotion
        accessibilityRole="button"
        accessibilityLabel="Open progress"
        onPress={onPress}
      >
        <Text>Progress</Text>
      </MotionPressable>,
    );

    await user.press(
      screen.getByRole("button", {
        name: "Open progress",
      }),
    );

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Animated.timing).not.toHaveBeenCalled();
  });

  it("animates screen entry when motion is enabled", async () => {
    jest
      .mocked(AccessibilityInfo.isReduceMotionEnabled)
      .mockResolvedValue(false);

    await render(
      <MotionScrollView>
        <Text>Screen content</Text>
      </MotionScrollView>,
    );

    await waitFor(() => {
      expect(Animated.timing).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          duration: 360,
          useNativeDriver: true,
          isInteraction: false,
        }),
      );
    });

    expect(screen.getByText("Screen content")).toBeTruthy();
  });

  it("renders screen content without animation in reduced-motion mode", async () => {
    await render(
      <MotionScrollView>
        <Text>Accessible content</Text>
      </MotionScrollView>,
    );

    expect(screen.getByText("Accessible content")).toBeTruthy();
    expect(Animated.timing).not.toHaveBeenCalled();
  });
});
