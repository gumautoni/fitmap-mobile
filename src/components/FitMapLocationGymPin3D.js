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
  primary = "#FF5722",
  primaryDark = "#C2410C",
  accent = "#2DD4BF",
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 260 260" fill="none">
      <Defs>
        <LinearGradient id="fitMapTile" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0" stopColor="#C5A68C" />
          <Stop offset="1" stopColor="#77513D" />
        </LinearGradient>

        <LinearGradient id="fitMapPinFace" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0" stopColor="#FFB66D" />
          <Stop offset="0.48" stopColor={primary} />
          <Stop offset="1" stopColor={primaryDark} />
        </LinearGradient>

        <LinearGradient id="fitMapPinLens" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#FFF0DE" />
        </LinearGradient>

        <LinearGradient id="fitMapStreet" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0" stopColor="#E4CBB0" />
          <Stop offset="1" stopColor="#A78769" />
        </LinearGradient>
      </Defs>

      {/* Plataforma do mapa em perspectiva */}
      <Ellipse
        cx="134"
        cy="231"
        rx="107"
        ry="15"
        fill="#27170F"
        opacity={0.32}
      />

      <Polygon
        points="14,186 119,139 247,192 142,239"
        fill="url(#fitMapStreet)"
      />

      <Polygon points="14,186 142,239 142,250 14,197" fill="#896549" />

      <Polygon points="142,239 247,192 247,203 142,250" fill="#624532" />

      {/* Quadras separadas pelas ruas */}
      <G>
        <Polygon points="28,187 63,172 96,186 61,201" fill="#C2A88E" />
        <Polygon points="71,168 93,158 127,172 105,182" fill="#B99C80" />
        <Polygon points="101,155 122,146 155,159 134,169" fill="#B1B9A1" />

        <Polygon points="73,206 108,190 136,202 101,218" fill="#A58B75" />
        <Polygon points="116,187 138,177 166,188 144,198" fill="#937E6B" />
        <Polygon points="145,173 166,164 195,176 174,185" fill="#A4B5A2" />

        <Polygon points="111,222 146,206 170,216 136,232" fill="#86B6A4" />
        <Polygon points="154,203 177,193 201,203 179,213" fill="#B69B81" />
        <Polygon points="184,189 205,180 229,190 208,199" fill="#D1B99D" />
      </G>

      {/* Ruas formando uma malha urbana */}
      <G stroke="#FFF4E8" strokeWidth="1.5" opacity={0.62}>
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
      <Polygon points="42,186 55,180 69,186 56,192" fill="#FFF1DF" />
      <Polygon points="42,186 56,192 56,204 42,198" fill="#AA8D73" />
      <Polygon points="56,192 69,186 69,198 56,204" fill="#80634C" />

      <Path d="M47 194L52 196M60 196L65 194" stroke="#FFE2BF" strokeWidth="2" />

      {/* Edificio no lado direito */}
      <Polygon points="196,187 207,182 219,187 208,192" fill="#FFF5E9" />
      <Polygon points="196,187 208,192 208,201 196,196" fill="#B3977D" />
      <Polygon points="208,192 219,187 219,196 208,201" fill="#8D7058" />

      <Path
        d="M201 194L205 196M212 195L216 193"
        stroke="#FFE7CA"
        strokeWidth="1.6"
      />

      {/* Pequeno edificio na parte frontal */}
      <Polygon points="165,202 176,197 187,202 176,207" fill="#F3E1CB" />
      <Polygon points="165,202 176,207 176,216 165,211" fill="#AC8B6F" />
      <Polygon points="176,207 187,202 187,211 176,216" fill="#8C6C53" />

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
        stroke="#FFF2D9"
        strokeWidth="1.6"
        opacity={0.6}
      />

      {/* Contorno frontal da plataforma */}
      <Path
        d="M14 186L142 239L247 192"
        stroke="#FFE2C4"
        strokeWidth="1.4"
        opacity={0.55}
      />

      <G transform="translate(0 -12)">
        {/* Profundidade e sombra do pino */}
        <Path
          d="M139 34C171 38 196 63 196 96C196 134 157 162 132 190C136 160 177 128 177 94C177 66 161 47 139 34Z"
          fill="#8A310F"
          opacity={0.52}
        />

        {/* Corpo do pino */}
        <Path
          d="M130 29C96 29 70 56 70 90C70 133 108 159 130 187C152 159 190 133 190 90C190 56 164 29 130 29Z"
          fill="url(#fitMapPinFace)"
        />

        <Path
          d="M130 39C103 39 81 62 81 90"
          stroke="#FFF0D5"
          strokeWidth="3"
          strokeLinecap="round"
          opacity={0.68}
        />

        <Path
          d="M174 65C181 88 173 110 162 126"
          stroke="#A7350C"
          strokeWidth="5"
          strokeLinecap="round"
          opacity={0.4}
        />

        {/* Lente do pino */}
        <Circle cx="130" cy="91" r="32" fill="#A84315" opacity={0.3} />
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

          <Rect x="103" y="79" width="6" height="16" rx="2" fill="#9A3412" />
          <Rect x="151" y="79" width="6" height="16" rx="2" fill="#9A3412" />
        </G>

        <Circle cx="118" cy="72" r="4" fill="#FFFFFF" opacity={0.5} />
      </G>

      {/* Pequenos detalhes de localizacao */}
      <Circle cx="42" cy="192" r="2.5" fill={accent} opacity={0.9} />
      <Circle cx="220" cy="204" r="2.5" fill="#FFFFFF" opacity={0.65} />
      <Path
        d="M98 228L118 219"
        stroke="#FFE6CC"
        strokeWidth="2"
        strokeLinecap="round"
        opacity={0.45}
      />
    </Svg>
  );
}
