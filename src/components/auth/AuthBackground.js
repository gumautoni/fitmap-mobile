import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
} from "react-native-svg";

/**
 * Ciclo 22-C3.3: um unico efeito de fita 3D, sem esferas.
 * O viewBox e escalado para toda a tela (inclusive em iPhones de alturas
 * diferentes), em vez de posicionar figuras pequenas no cabecalho.
 * Esta camada nao intercepta toques nem altera os formularios.
 */
const RIBBON_PATH =
  "M 245 -60 C 275 25 414 48 394 148 " +
  "C 379 224 318 245 366 326 " +
  "C 422 424 405 476 330 552 " +
  "C 255 625 177 655 103 733 " +
  "C 52 788 5 822 -35 902";

export default function AuthBackground() {
  return (
    <View pointerEvents="none" accessible={false} style={styles.layer}>
      <LinearGradient
        colors={["#FAFCFF", "#F2F6FF", "#F8FAFF"]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 390 844"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFillObject}
        accessible={false}
      >
        <Defs>
          <SvgLinearGradient
            id="fitmapRibbon"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <Stop offset="0%" stopColor="#F0F6FF" />
            <Stop offset="30%" stopColor="#BDD1FF" />
            <Stop offset="64%" stopColor="#8FAFFF" />
            <Stop offset="100%" stopColor="#DCE8FF" />
          </SvgLinearGradient>
        </Defs>

        {/* Sombra suave para dar volume sem escurecer o texto. */}
        <Path
          d={RIBBON_PATH}
          fill="none"
          stroke="#9BB6F4"
          strokeWidth={47}
          strokeLinecap="round"
          opacity={0.12}
          transform="translate(5 8)"
        />

        {/* Uma unica fita continua do topo ate a base. */}
        <Path
          d={RIBBON_PATH}
          fill="none"
          stroke="url(#fitmapRibbon)"
          strokeWidth={36}
          strokeLinecap="round"
          opacity={0.53}
        />

        {/* Borda luminosa fina, responsavel pelo acabamento 3D. */}
        <Path
          d={RIBBON_PATH}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.66}
          transform="translate(-9 -8)"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
});
