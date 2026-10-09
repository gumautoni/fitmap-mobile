import React from "react";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";

export default function FitMapPerformanceMark({
  size = 150,
  primary = "#3F51E8",
  primaryDark = "#303FBE",
  accent = "#5CC8FF",
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Defs>
        <LinearGradient id="performanceRing" x1="26" y1="26" x2="176" y2="174">
          <Stop offset="0" stopColor={accent} stopOpacity="0.95" />

          <Stop offset="0.4" stopColor={primary} />

          <Stop offset="1" stopColor={primaryDark} />
        </LinearGradient>

        <LinearGradient id="pinSurface" x1="76" y1="50" x2="127" y2="139">
          <Stop offset="0" stopColor="#FFFFFF" />

          <Stop offset="1" stopColor="#E2E6FF" />
        </LinearGradient>

        <RadialGradient id="performanceGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={accent} stopOpacity="0.28" />

          <Stop offset="1" stopColor={accent} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Circle cx="100" cy="100" r="78" fill="url(#performanceGlow)" />

      <Circle
        cx="100"
        cy="100"
        r="66"
        stroke="url(#performanceRing)"
        strokeWidth="11"
        strokeDasharray="9 8"
        strokeLinecap="round"
      />

      <Circle
        cx="100"
        cy="100"
        r="51"
        stroke={accent}
        strokeWidth="2"
        opacity="0.3"
      />

      <Circle
        cx="100"
        cy="100"
        r="36"
        stroke="#FFFFFF"
        strokeWidth="1"
        opacity="0.15"
      />

      <Path
        d="M32 100H54"
        stroke={accent}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.75"
      />

      <Path
        d="M146 100H168"
        stroke={accent}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.75"
      />

      <Path
        d="M100 32V54"
        stroke={accent}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.75"
      />

      <Path
        d="M100 146V168"
        stroke={accent}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.75"
      />

      <Path
        d="M54 54L69 69"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.18"
      />

      <Path
        d="M131 131L146 146"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.18"
      />

      <G>
        <Path
          d="M100 48C80.67 48 65 63.67 65 83C65 111 100 148 100 148C100 148 135 111 135 83C135 63.67 119.33 48 100 48Z"
          fill="url(#pinSurface)"
        />

        <Path
          d="M100 56C85.09 56 73 68.09 73 83C73 102.1 93.3 128.6 100 136.9C106.7 128.6 127 102.1 127 83C127 68.09 114.91 56 100 56Z"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          opacity="0.72"
        />

        <Circle cx="100" cy="83" r="17" fill={primary} />

        <Circle cx="100" cy="83" r="9" fill={primaryDark} />

        <Circle cx="100" cy="83" r="4" fill={accent} />
      </G>

      <Ellipse cx="100" cy="167" rx="37" ry="9" fill="#050814" opacity="0.18" />

      <Circle cx="48" cy="124" r="3.5" fill={accent} opacity="0.8" />

      <Circle cx="151" cy="69" r="2.5" fill="#FFFFFF" opacity="0.55" />
    </Svg>
  );
}
