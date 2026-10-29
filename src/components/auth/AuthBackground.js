import React from "react";
import { ImageBackground, StyleSheet } from "react-native";

/**
 * Ciclo 22-C3.5: o fundo e uma imagem nativa que ENVOLVE o conteudo.
 * Nao existe SVG absoluto sobre o formulario nem disputa de zIndex.
 * A fita e a mesma arte aprovada no 22-C3.3, sem esfera.
 */
export default function AuthBackground({ children }) {
  return (
    <ImageBackground
      source={require("../../../assets/images/auth-ribbon-background.png")}
      resizeMode="stretch"
      style={styles.background}
    >
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
  },
});
