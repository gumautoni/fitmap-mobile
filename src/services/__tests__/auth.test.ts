import { apiClient } from "../apiClient";
import {
  getCurrentUser,
  loginAccount,
  logoutSession,
  refreshSession,
  registerAccount,
} from "../auth";

jest.mock("../apiClient", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedGet = apiClient.get as jest.Mock;
const mockedPost = apiClient.post as jest.Mock;

describe("auth service", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPost.mockReset();
  });

  it("registers an account and normalizes the backend response", async () => {
    mockedPost.mockResolvedValue({
      user: {
        id: "user-123",
        name: "FitMap User",
        email: "user@example.com",
        created_at: "2026-10-13T12:00:00Z",
      },
      tokens: {
        access_token: "access-token",
        access_token_expires_at: "2026-10-13T12:15:00Z",
        refresh_token: "refresh-token",
        refresh_token_expires_at: "2026-11-12T12:00:00Z",
        token_type: "bearer",
      },
    });

    const result = await registerAccount(
      "FitMap User",
      "user@example.com",
      "123456789012345",
    );

    expect(mockedPost).toHaveBeenCalledWith("/auth/register", {
      name: "FitMap User",
      email: "user@example.com",
      password: "123456789012345",
    });

    expect(result).toEqual({
      user: {
        id: "user-123",
        name: "FitMap User",
        email: "user@example.com",
        createdAt: "2026-10-13T12:00:00Z",
      },
      tokens: {
        accessToken: "access-token",
        accessTokenExpiresAt: "2026-10-13T12:15:00Z",
        refreshToken: "refresh-token",
        refreshTokenExpiresAt: "2026-11-12T12:00:00Z",
        tokenType: "bearer",
      },
    });
  });

  it("logs in and normalizes the authenticated session", async () => {
    mockedPost.mockResolvedValue({
      user: {
        id: "user-456",
        name: "Existing User",
        email: "existing@example.com",
        created_at: "2026-10-01T08:00:00Z",
      },
      tokens: {
        access_token: "login-access-token",
        access_token_expires_at: "2026-10-13T12:15:00Z",
        refresh_token: "login-refresh-token",
        refresh_token_expires_at: "2026-11-12T12:00:00Z",
        token_type: "bearer",
      },
    });

    const result = await loginAccount(
      "existing@example.com",
      "123456789012345",
    );

    expect(mockedPost).toHaveBeenCalledWith("/auth/login", {
      email: "existing@example.com",
      password: "123456789012345",
    });

    expect(result.user.id).toBe("user-456");
    expect(result.tokens.accessToken).toBe("login-access-token");
    expect(result.tokens.refreshToken).toBe("login-refresh-token");
  });

  it("refreshes the session using the opaque refresh token", async () => {
    mockedPost.mockResolvedValue({
      access_token: "new-access-token",
      access_token_expires_at: "2026-10-13T12:30:00Z",
      refresh_token: "new-refresh-token",
      refresh_token_expires_at: "2026-11-12T12:00:00Z",
      token_type: "bearer",
    });

    const result = await refreshSession("current-refresh-token");

    expect(mockedPost).toHaveBeenCalledWith("/auth/refresh", {
      refresh_token: "current-refresh-token",
    });

    expect(result).toEqual({
      accessToken: "new-access-token",
      accessTokenExpiresAt: "2026-10-13T12:30:00Z",
      refreshToken: "new-refresh-token",
      refreshTokenExpiresAt: "2026-11-12T12:00:00Z",
      tokenType: "bearer",
    });
  });

  it("loads the current user with the bearer access token", async () => {
    mockedGet.mockResolvedValue({
      id: "user-789",
      name: "Current User",
      email: "current@example.com",
      created_at: "2026-10-10T10:00:00Z",
    });

    const result = await getCurrentUser("current-access-token");

    expect(mockedGet).toHaveBeenCalledWith("/auth/me", {
      headers: {
        Authorization: "Bearer current-access-token",
      },
    });

    expect(result).toEqual({
      id: "user-789",
      name: "Current User",
      email: "current@example.com",
      createdAt: "2026-10-10T10:00:00Z",
    });
  });

  it("logs out the current backend session using the bearer token", async () => {
    mockedPost.mockResolvedValue(null);

    await logoutSession("current-access-token");

    expect(mockedPost).toHaveBeenCalledWith("/auth/logout", undefined, {
      headers: {
        Authorization: "Bearer current-access-token",
      },
    });
  });
});
