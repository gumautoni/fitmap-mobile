import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const REFRESH_TOKEN_KEY = "fitmap.auth.refresh-token";

const LEGACY_AUTH_KEYS = ["fitmap_users", "fitmap_session"];

export async function clearLegacyAuthStorage(): Promise<void> {
  await AsyncStorage.multiRemove(LEGACY_AUTH_KEYS);
}

export async function saveRefreshToken(refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function deleteRefreshToken(): Promise<void> {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
