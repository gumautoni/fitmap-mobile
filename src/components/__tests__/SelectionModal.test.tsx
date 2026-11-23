import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native";
import type { ReactNode } from "react";
import {
  AccessibilityInfo,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import SelectionModal, { type SelectionModalContent } from "../SelectionModal";
import { darkTheme, lightTheme, type AppTheme } from "../../theme/themes";

let mockTheme: AppTheme = lightTheme;

jest.mock("../../theme/ThemeProvider", () => ({
  useAppTheme: () => ({
    theme: mockTheme,
  }),
}));

jest.mock("react-native-safe-area-context", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");

  return {
    SafeAreaView: ({
      children,
      style,
    }: {
      children: ReactNode;
      style?: StyleProp<ViewStyle>;
    }) => React.createElement(View, { style }, children),
  };
});

const TITLE = "Duracao preferida";

function createSelection() {
  const onSelect = jest.fn();
  const onClose = jest.fn();

  const selection: SelectionModalContent = {
    title: TITLE,
    description: "Selecione uma opcao.",
    options: [15, 30, 45, 60, 75, 90, 120, 150, 180].map((minutes) => ({
      label: `${minutes} minutos`,
      checked: minutes === 45,
      onSelect: () => onSelect(minutes),
    })),
  };

  return { selection, onSelect, onClose };
}

function getPanel() {
  let current = screen.getByRole("header", {
    name: TITLE,
  }).parent;

  while (current && current.props.accessibilityViewIsModal !== true) {
    current = current.parent;
  }

  if (!current) {
    throw new Error("Accessible modal panel not found.");
  }

  return current;
}

function getNativeModal() {
  let current = getPanel().parent;

  while (current && typeof current.props.animationType !== "string") {
    current = current.parent;
  }

  if (!current) {
    throw new Error("Native modal not found.");
  }

  return current;
}

describe("SelectionModal accessibility", () => {
  beforeEach(() => {
    mockTheme = lightTheme;

    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(true);

    jest
      .spyOn(AccessibilityInfo, "addEventListener")
      .mockReturnValue({ remove: jest.fn() });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    { theme: lightTheme, reduced: true },
    { theme: lightTheme, reduced: false },
    { theme: darkTheme, reduced: true },
    { theme: darkTheme, reduced: false },
  ])(
    "preserves $theme.mode theme and reducedMotion=$reduced",
    async ({ theme, reduced }) => {
      mockTheme = theme;

      jest
        .mocked(AccessibilityInfo.isReduceMotionEnabled)
        .mockResolvedValue(reduced);

      const { selection, onClose, onSelect } = createSelection();

      await render(<SelectionModal selection={selection} onClose={onClose} />);

      const panel = getPanel();
      const modal = getNativeModal();

      expect(modal).toHaveProp("animationType", reduced ? "none" : "fade");

      expect(modal).toHaveProp("onRequestClose", expect.any(Function));

      expect(panel).toHaveStyle({
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
      });

      const radios = within(panel).getAllByRole("radio");

      expect(radios).toHaveLength(9);

      expect(radios.map((radio) => radio.props.accessibilityLabel)).toEqual(
        selection.options.map((option) => option.label),
      );

      const checked = within(panel).getByRole("radio", {
        name: "45 minutos",
      });

      const unchecked = within(panel).getByRole("radio", {
        name: "180 minutos",
      });

      expect(checked).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ checked: true }),
      );

      expect(unchecked).toHaveProp(
        "accessibilityState",
        expect.objectContaining({ checked: false }),
      );

      expect(checked).toHaveStyle({
        minHeight: 48,
        minWidth: 48,
        backgroundColor: theme.colors.primarySoft,
        borderColor: theme.colors.primary,
      });

      expect(unchecked).toHaveStyle({
        minHeight: 48,
        minWidth: 48,
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
      });

      expect(within(panel).getByText("45 minutos")).toHaveStyle({
        color: theme.colors.textPrimary,
      });

      const cancel = within(panel).getByRole("button", {
        name: "Cancelar",
      });

      expect(cancel).toHaveStyle({
        minHeight: 48,
        minWidth: 48,
      });

      expect(onSelect).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();

      await fireEvent.press(unchecked);

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(180);
      expect(onClose).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["selection", "cancel"] as const)(
    "prevents duplicate actions after %s",
    async (firstAction) => {
      const { selection, onClose, onSelect } = createSelection();

      await render(<SelectionModal selection={selection} onClose={onClose} />);

      const first = screen.getByRole("radio", {
        name: "15 minutos",
      });

      const second = screen.getByRole("radio", {
        name: "180 minutos",
      });

      const cancel = screen.getByRole("button", {
        name: "Cancelar",
      });

      if (firstAction === "selection") {
        await fireEvent.press(first);
        await fireEvent.press(first);
        await fireEvent.press(second);
        await fireEvent.press(cancel);

        expect(onSelect.mock.calls).toEqual([[15]]);
      } else {
        await fireEvent.press(cancel);
        await fireEvent.press(cancel);
        await fireEvent.press(first);
        await fireEvent.press(second);

        expect(onSelect).not.toHaveBeenCalled();
      }

      expect(onClose).toHaveBeenCalledTimes(1);
    },
  );
});
