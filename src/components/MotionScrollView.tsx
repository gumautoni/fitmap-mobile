import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Animated, Easing, type ScrollViewProps } from "react-native";

import { useReducedMotion } from "../hooks/useReducedMotion";

export default function MotionScrollView({ style, ...props }: ScrollViewProps) {
  const reduceMotion = useReducedMotion();

  const [progress] = useState(() => new Animated.Value(1));

  useFocusEffect(
    useCallback(() => {
      progress.stopAnimation();

      if (reduceMotion) {
        progress.setValue(1);
        return;
      }

      progress.setValue(0);

      const animation = Animated.timing(progress, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
        isInteraction: false,
      });

      animation.start();

      return () => {
        animation.stop();
        progress.setValue(1);
      };
    }, [progress, reduceMotion]),
  );

  const animatedStyle = {
    opacity: progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.82, 1],
    }),
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
    ],
  };

  return (
    <Animated.ScrollView
      {...props}
      style={[style, reduceMotion ? undefined : animatedStyle]}
    />
  );
}
