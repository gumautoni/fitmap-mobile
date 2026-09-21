import * as Location from "expo-location";

export async function requestForegroundLocation(): Promise<Location.LocationObject> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();

  if (!servicesEnabled) {
    throw new Error(
      "A localização do aparelho está desativada. Ative a localização nas configurações do celular.",
    );
  }

  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== "granted") {
    throw new Error(
      "Permissão de localização negada. Autorize o uso da localização para buscar academias próximas.",
    );
  }

  try {
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      mayShowUserSettingsDialog: true,
    });
  } catch {
    const lastKnownLocation = await Location.getLastKnownPositionAsync();

    if (lastKnownLocation) {
      return lastKnownLocation;
    }

    throw new Error(
      "Não foi possível obter sua localização atual. Tente novamente ou pesquise por cidade/bairro.",
    );
  }
}
