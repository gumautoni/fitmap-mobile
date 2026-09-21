const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error(
    "EXPO_PUBLIC_API_URL is not configured. Define it in your local environment.",
  );
}

export const environment = {
  apiUrl: apiUrl.replace(/\/+$/, ""),
} as const;
