import { apiClient } from "./apiClient";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface AuthUserResponse {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  tokenType: string;
}

interface AuthTokensResponse {
  access_token: string;
  access_token_expires_at: string;
  refresh_token: string;
  refresh_token_expires_at: string;
  token_type: string;
}

interface AuthResponse {
  user: AuthUserResponse;
  tokens: AuthTokensResponse;
}

function normalizeUser(user: AuthUserResponse): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.created_at,
  };
}

function normalizeTokens(tokens: AuthTokensResponse): AuthTokens {
  return {
    accessToken: tokens.access_token,
    accessTokenExpiresAt: tokens.access_token_expires_at,
    refreshToken: tokens.refresh_token,
    refreshTokenExpiresAt: tokens.refresh_token_expires_at,
    tokenType: tokens.token_type,
  };
}

function buildAuthorizationHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function registerAccount(
  name: string,
  email: string,
  password: string,
): Promise<{
  user: AuthUser;
  tokens: AuthTokens;
}> {
  const response = await apiClient.post<AuthResponse>("/auth/register", {
    name,
    email,
    password,
  });

  return {
    user: normalizeUser(response.user),
    tokens: normalizeTokens(response.tokens),
  };
}

export async function loginAccount(
  email: string,
  password: string,
): Promise<{
  user: AuthUser;
  tokens: AuthTokens;
}> {
  const response = await apiClient.post<AuthResponse>("/auth/login", {
    email,
    password,
  });

  return {
    user: normalizeUser(response.user),
    tokens: normalizeTokens(response.tokens),
  };
}

export async function refreshSession(
  refreshToken: string,
): Promise<AuthTokens> {
  const response = await apiClient.post<AuthTokensResponse>("/auth/refresh", {
    refresh_token: refreshToken,
  });

  return normalizeTokens(response);
}

export async function getCurrentUser(accessToken: string): Promise<AuthUser> {
  const response = await apiClient.get<AuthUserResponse>("/auth/me", {
    headers: buildAuthorizationHeaders(accessToken),
  });

  return normalizeUser(response);
}

export async function logoutSession(accessToken: string): Promise<void> {
  await apiClient.post<null>("/auth/logout", undefined, {
    headers: buildAuthorizationHeaders(accessToken),
  });
}
