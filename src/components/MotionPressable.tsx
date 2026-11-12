import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, type PressableProps } from "react-native";

type MotionPressableProps = PressableProps & {
  reduceMotion: boolean;
};

export default function MotionPressable({
  reduceMotion,
  disabled,
  onPressIn,
  onPressOut,
  ...props
}: MotionPressableProps) {
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    scale.stopAnimation();
    scale.setValue(1);

    return () => {
      scale.stopAnimation();
    };
  }, [scale, reduceMotion, disabled]);

  function animateTo(value: number, duration: number) {
    scale.stopAnimation();

    if (reduceMotion || disabled) {
      scale.setValue(1);
      return;
    }

    Animated.timing(scale, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    }).start();
  }

  return (
    <Animated.View
      style={reduceMotion ? undefined : { transform: [{ scale }] }}
    >
      <Pressable
        {...props}
        disabled={disabled}
        onPressIn={(event) => {
          animateTo(0.975, 120);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          animateTo(1, 180);
          onPressOut?.(event);
        }}
      />
    </Animated.View>
  );
}
