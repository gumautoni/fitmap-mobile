import React from "react";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
} from "react-native-svg";

export default function FitMapLocationGymPin3D({
  size = 194,
  primary = "#2563EB",
  primaryDark = "#1D4ED8",
  accent = "#5CC8FF",
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 260 260" fill="none">
      <Defs>
        <LinearGradient id="fitMapTile" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0" stopColor="#5669B5" />
          <Stop offset="1" stopColor="#26346F" />
        </LinearGradient>

        <LinearGradient id="fitMapPinFace" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0" stopColor="#79B8FF" />
          <Stop offset="0.48" stopColor={primary} />
          <Stop offset="1" stopColor={primaryDark} />
        </LinearGradient>

        <LinearGradient id="fitMapPinLens" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#CDEAFF" />
        </LinearGradient>

        <LinearGradient id="fitMapStreet" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0" stopColor="#9DB8E5" />
          <Stop offset="1" stopColor="#6A83BC" />
        </LinearGradient>
      </Defs>

      {/* Plataforma do mapa em perspectiva */}
      <Ellipse
        cx="134"
        cy="231"
        rx="107"
        ry="15"
        fill="#08122D"
        opacity={0.32}
      />

      <Polygon
        points="14,186 119,139 247,192 142,239"
        fill="url(#fitMapStreet)"
      />

      <Polygon points="14,186 142,239 142,250 14,197" fill="#31477C" />

      <Polygon points="142,239 247,192 247,203 142,250" fill="#1E315D" />

      {/* Quadras separadas pelas ruas */}
      <G>
        <Polygon points="28,187 63,172 96,186 61,201" fill="#6386A2" />
        <Polygon points="71,168 93,158 127,172 105,182" fill="#587E9C" />
        <Polygon points="101,155 122,146 155,159 134,169" fill="#6A9F9C" />

        <Polygon points="73,206 108,190 136,202 101,218" fill="#466D8D" />
        <Polygon points="116,187 138,177 166,188 144,198" fill="#3C6986" />
        <Polygon points="145,173 166,164 195,176 174,185" fill="#568E8A" />

        <Polygon points="111,222 146,206 170,216 136,232" fill="#4D9A8B" />
        <Polygon points="154,203 177,193 201,203 179,213" fill="#527C98" />
        <Polygon points="184,189 205,180 229,190 208,199" fill="#668FA7" />
      </G>

      {/* Ruas formando uma malha urbana */}
      <G stroke="#ECF6FF" strokeWidth="1.5" opacity={0.62}>
        <Path d="M58 166L186 219" />
        <Path d="M89 153L217 206" />
        <Path d="M61 206L166 159" />
        <Path d="M102 223L207 176" />
      </G>

      {/* Centro das vias e pequenos detalhes */}
      <G
        stroke="#FFFFFF"
        strokeWidth="1.2"
        opacity={0.55}
        strokeDasharray="5 7"
      >
        <Path d="M58 166L186 219" />
        <Path d="M61 206L166 159" />
      </G>

      {/* Edificio isometrico no lado esquerdo */}
      <Polygon points="42,186 55,180 69,186 56,192" fill="#D2E8F2" />
      <Polygon points="42,186 56,192 56,204 42,198" fill="#617DAA" />
      <Polygon points="56,192 69,186 69,198 56,204" fill="#385987" />

      <Path d="M47 194L52 196M60 196L65 194" stroke="#B4E7FF" strokeWidth="2" />

      {/* Edificio no lado direito */}
      <Polygon points="196,187 207,182 219,187 208,192" fill="#E1EDF8" />
      <Polygon points="196,187 208,192 208,201 196,196" fill="#6583A8" />
      <Polygon points="208,192 219,187 219,196 208,201" fill="#45668E" />

      <Path
        d="M201 194L205 196M212 195L216 193"
        stroke="#C8EFFF"
        strokeWidth="1.6"
      />

      {/* Pequeno edificio na parte frontal */}
      <Polygon points="165,202 176,197 187,202 176,207" fill="#C1E1EB" />
      <Polygon points="165,202 176,207 176,216 165,211" fill="#496A91" />
      <Polygon points="176,207 187,202 187,211 176,216" fill="#32557C" />

      {/* Areas verdes e arvores */}
      <G>
        <Ellipse
          cx="137"
          cy="218"
          rx="14"
          ry="6"
          fill="#276E76"
          opacity={0.5}
        />

        <Path d="M133 219V207M145 222V211" stroke="#2E7772" strokeWidth="2.5" />

        <Circle cx="133" cy="207" r="6" fill="#80C9A8" />
        <Circle cx="128" cy="211" r="4.5" fill="#4FA58F" />
        <Circle cx="139" cy="212" r="4.5" fill="#65B49E" />

        <Circle cx="145" cy="211" r="5" fill="#A5DBB4" />
        <Circle cx="150" cy="215" r="4" fill="#5DAF95" />

        <Circle cx="116" cy="153" r="3" fill="#A0DDB6" />
        <Circle cx="123" cy="155" r="3" fill="#65BC9F" />
      </G>

      {/* Destino marcado sobre o mapa */}
      <Ellipse cx="130" cy="188" rx="42" ry="13" fill={accent} opacity={0.13} />

      <Ellipse
        cx="130"
        cy="187"
        rx="34"
        ry="10"
        stroke={accent}
        strokeWidth="2.3"
        opacity={0.78}
      />

      <Ellipse
        cx="130"
        cy="187"
        rx="23"
        ry="7"
        stroke="#E6FAFF"
        strokeWidth="1.6"
        opacity={0.6}
      />

      {/* Contorno frontal da plataforma */}
      <Path
        d="M14 186L142 239L247 192"
        stroke="#D0E6FF"
        strokeWidth="1.4"
        opacity={0.55}
      />

      <G transform="translate(0 -12)">
        {/* Profundidade e sombra do pino */}
        <Path
          d="M139 34C171 38 196 63 196 96C196 134 157 162 132 190C136 160 177 128 177 94C177 66 161 47 139 34Z"
          fill="#102F7F"
          opacity={0.52}
        />

        {/* Corpo do pino */}
        <Path
          d="M130 29C96 29 70 56 70 90C70 133 108 159 130 187C152 159 190 133 190 90C190 56 164 29 130 29Z"
          fill="url(#fitMapPinFace)"
        />

        <Path
          d="M130 39C103 39 81 62 81 90"
          stroke="#DDF5FF"
          strokeWidth="3"
          strokeLinecap="round"
          opacity={0.68}
        />

        <Path
          d="M174 65C181 88 173 110 162 126"
          stroke="#123B91"
          strokeWidth="5"
          strokeLinecap="round"
          opacity={0.4}
        />

        {/* Lente do pino */}
        <Circle cx="130" cy="91" r="32" fill="#153F91" opacity={0.3} />
        <Circle cx="130" cy="87" r="32" fill="url(#fitMapPinLens)" />
        <Circle
          cx="130"
          cy="87"
          r="27"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          opacity={0.85}
        />

        {/* Halter: simbolo de academia */}
        <G transform="rotate(-25 130 87)">
          <Path
            d="M112 87H148"
            stroke={primaryDark}
            strokeWidth="6"
            strokeLinecap="round"
          />

          <Rect x="108" y="75" width="9" height="24" rx="3" fill={primary} />
          <Rect x="143" y="75" width="9" height="24" rx="3" fill={primary} />

          <Rect x="103" y="79" width="6" height="16" rx="2" fill="#204EA9" />
          <Rect x="151" y="79" width="6" height="16" rx="2" fill="#204EA9" />
        </G>

        <Circle cx="118" cy="72" r="4" fill="#FFFFFF" opacity={0.5} />
      </G>

      {/* Pequenos detalhes de localizacao */}
      <Circle cx="42" cy="192" r="2.5" fill={accent} opacity={0.9} />
      <Circle cx="220" cy="204" r="2.5" fill="#FFFFFF" opacity={0.65} />
      <Path
        d="M98 228L118 219"
        stroke="#D5E7FF"
        strokeWidth="2"
        strokeLinecap="round"
        opacity={0.45}
      />
    </Svg>
  );
}
