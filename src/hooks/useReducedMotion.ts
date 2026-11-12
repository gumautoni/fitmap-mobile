import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let active = true;
    let preferenceChanged = false;

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        preferenceChanged = true;

        if (active) {
          setReduceMotion(enabled);
        }
      },
    );

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active && !preferenceChanged) {
          setReduceMotion(enabled);
        }
      })
      .catch(() => {
        // Preserve the safe default when unavailable.
      });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
