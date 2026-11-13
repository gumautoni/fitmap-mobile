import { act, render, waitFor } from "@testing-library/react-native";
import { type ContextType, useContext, useEffect } from "react";

import {
  getCurrentUser,
  loginAccount,
  logoutSession,
  logoutSessionByRefreshToken,
  refreshSession,
  registerAccount,
  type AuthTokens,
  type AuthUser,
} from "../../services/auth";
import { ApiClientError } from "../../services/apiClient";
import {
  clearLegacyAuthStorage,
  deleteRefreshToken,
  getRefreshToken,
  saveRefreshToken,
} from "../../services/authStorage";
import { AuthContext, AuthProvider } from "../AuthContext";

jest.mock("../../config/environment", () => ({
  environment: {
    apiUrl: "https://example.test",
  },
}));

jest.mock("../../services/auth", () => ({
  getCurrentUser: jest.fn(),
  loginAccount: jest.fn(),
  logoutSession: jest.fn(),
  logoutSessionByRefreshToken: jest.fn(),
  refreshSession: jest.fn(),
  registerAccount: jest.fn(),
}));

jest.mock("../../services/authStorage", () => ({
  clearLegacyAuthStorage: jest.fn(),
  deleteRefreshToken: jest.fn(),
  getRefreshToken: jest.fn(),
  saveRefreshToken: jest.fn(),
}));

type AuthValue = NonNullable<ContextType<typeof AuthContext>>;
type Outcome = "resolved" | "rejected";

const mockedLogin = jest.mocked(loginAccount);
const mockedCurrentUser = jest.mocked(getCurrentUser);
const mockedLogout = jest.mocked(logoutSession);
const mockedLogoutByRefresh = jest.mocked(logoutSessionByRefreshToken);
const mockedRegister = jest.mocked(registerAccount);
const mockedRefresh = jest.mocked(refreshSession);

const mockedClearLegacy = jest.mocked(clearLegacyAuthStorage);
const mockedDelete = jest.mocked(deleteRefreshToken);
const mockedGet = jest.mocked(getRefreshToken);
const mockedSave = jest.mocked(saveRefreshToken);

let current: AuthValue | null = null;
let storedToken: string | null = null;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;

  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });

  return { promise, resolve, reject };
}

function observe(promise: Promise<unknown>): Promise<Outcome> {
  return promise.then(
    () => "resolved",
    () => "rejected",
  );
}

function makeUser(label: string): AuthUser {
  return {
    id: `user-${label}`,
    name: `User ${label}`,
    email: `${label}@example.test`,
    createdAt: "2026-11-13T12:00:00Z",
  };
}

function makeTokens(label: string): AuthTokens {
  return {
    accessToken: `access-${label}`,
    accessTokenExpiresAt: "2026-11-13T12:15:00Z",
    refreshToken: `refresh-${label}`,
    refreshTokenExpiresAt: "2026-12-13T12:00:00Z",
    tokenType: "bearer",
  };
}

function Probe() {
  const context = useContext(AuthContext);

  useEffect(() => {
    current = context;
  }, [context]);

  return null;
}

function auth(): AuthValue {
  if (!current) {
    throw new Error("AuthContext not mounted.");
  }

  return current;
}

async function mountProvider() {
  await render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

  await waitFor(() => {
    expect(auth().loading).toBe(false);
  });
}

async function loginAs(label: string) {
  const user = makeUser(label);

  mockedLogin.mockResolvedValueOnce({
    user,
    tokens: makeTokens(label),
  });

  await act(async () => {
    await auth().login(user.email, "synthetic-password");
  });

  expect(auth().user).toEqual(user);
}

async function logout() {
  await act(async () => {
    await auth().logout();
  });
}

describe("AuthProvider session lifecycle", () => {
  beforeEach(() => {
    jest.resetAllMocks();

    current = null;
    storedToken = null;

    mockedClearLegacy.mockResolvedValue(undefined);
    mockedLogout.mockResolvedValue(undefined);
    mockedLogoutByRefresh.mockResolvedValue(undefined);

    mockedGet.mockImplementation(async () => storedToken);

    mockedSave.mockImplementation(async (token) => {
      storedToken = token;
    });

    mockedDelete.mockImplementation(async () => {
      storedToken = null;
    });
  });

  it("shares one refresh operation between concurrent callers", async () => {
    await mountProvider();
    await loginAs("first");

    const gate = deferred<AuthTokens>();
    mockedRefresh.mockReturnValueOnce(gate.promise);

    let first!: Promise<string>;
    let second!: Promise<string>;

    await act(async () => {
      first = auth().refreshAccessToken();
      second = auth().refreshAccessToken();
    });

    await waitFor(() => {
      expect(mockedRefresh).toHaveBeenCalledTimes(1);
    });

    const replacement = makeTokens("rotated");

    await act(async () => {
      gate.resolve(replacement);

      expect(await first).toBe(replacement.accessToken);
      expect(await second).toBe(replacement.accessToken);
    });

    expect(storedToken).toBe(replacement.refreshToken);
    expect(auth().accessToken).toBe(replacement.accessToken);
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it("does not restore tokens when refresh completes after logout", async () => {
    await mountProvider();
    await loginAs("first");

    const gate = deferred<AuthTokens>();
    mockedRefresh.mockReturnValueOnce(gate.promise);

    let pending!: Promise<Outcome>;

    await act(async () => {
      pending = observe(auth().refreshAccessToken());
    });

    await waitFor(() => {
      expect(mockedRefresh).toHaveBeenCalledTimes(1);
    });

    await logout();

    await act(async () => {
      gate.resolve(makeTokens("stale"));
      await pending;
    });

    expect(auth().user).toBeNull();
    expect(auth().accessToken).toBeNull();
    expect(storedToken).toBeNull();
    expect(await pending).toBe("rejected");
  });

  it("does not clear a newer session when an older refresh fails", async () => {
    await mountProvider();
    await loginAs("first");

    const gate = deferred<AuthTokens>();
    mockedRefresh.mockReturnValueOnce(gate.promise);

    let pending!: Promise<Outcome>;

    await act(async () => {
      pending = observe(auth().refreshAccessToken());
    });

    await waitFor(() => {
      expect(mockedRefresh).toHaveBeenCalledTimes(1);
    });

    await logout();
    await loginAs("second");

    await act(async () => {
      gate.reject(new Error("Previous refresh failed."));
      await pending;
    });

    expect(auth().user).toEqual(makeUser("second"));
    expect(auth().accessToken).toBe(makeTokens("second").accessToken);
    expect(storedToken).toBe(makeTokens("second").refreshToken);
  });

  it("does not retry an old authenticated request with another account", async () => {
    await mountProvider();
    await loginAs("first");

    const gate = deferred<string>();

    const request = jest
      .fn<Promise<string>, [string]>()
      .mockReturnValueOnce(gate.promise)
      .mockResolvedValue("unexpected-retry");

    let pending!: Promise<Outcome>;

    await act(async () => {
      pending = observe(auth().runAuthenticatedRequest(request));
    });

    expect(request).toHaveBeenCalledWith(makeTokens("first").accessToken);

    await logout();
    await loginAs("second");

    await act(async () => {
      gate.reject(
        new ApiClientError(
          "Invalid access token.",
          401,
          "invalid_access_token",
        ),
      );

      await pending;
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(await pending).toBe("rejected");
    expect(auth().user).toEqual(makeUser("second"));
  });

  it("does not authenticate after logout invalidates a pending login", async () => {
    await mountProvider();

    const gate = deferred<{
      user: AuthUser;
      tokens: AuthTokens;
    }>();

    mockedLogin.mockReturnValueOnce(gate.promise);

    let pending!: Promise<Outcome>;

    await act(async () => {
      pending = observe(
        auth().login("first@example.test", "synthetic-password"),
      );
    });

    await waitFor(() => {
      expect(mockedLogin).toHaveBeenCalledTimes(1);
    });

    await logout();

    await act(async () => {
      gate.resolve({
        user: makeUser("first"),
        tokens: makeTokens("first"),
      });

      await pending;
    });

    expect(auth().user).toBeNull();
    expect(auth().accessToken).toBeNull();
    expect(storedToken).toBeNull();
    expect(await pending).toBe("rejected");
  });

  it("removes a refresh token when logout occurs during a pending storage write", async () => {
    await mountProvider();
    await loginAs("first");

    const gate = deferred<void>();
    const replacement = makeTokens("rotated");

    mockedRefresh.mockResolvedValueOnce(replacement);

    mockedSave.mockImplementationOnce(async (token) => {
      await gate.promise;
      storedToken = token;
    });

    let pendingRefresh!: Promise<Outcome>;

    await act(async () => {
      pendingRefresh = observe(auth().refreshAccessToken());
    });

    await waitFor(() => {
      expect(mockedSave).toHaveBeenCalledWith(replacement.refreshToken);
    });

    let pendingLogout!: Promise<Outcome>;

    await act(async () => {
      pendingLogout = observe(auth().logout());
    });

    expect(auth().user).toBeNull();
    expect(auth().accessToken).toBeNull();

    await act(async () => {
      gate.resolve(undefined);

      expect(await pendingRefresh).toBe("rejected");
      expect(await pendingLogout).toBe("resolved");
    });

    expect(storedToken).toBeNull();
    expect(auth().accessToken).toBeNull();
    expect(auth().user).toBeNull();
  });

  it("preserves a new login when an earlier logout is deleting storage", async () => {
    await mountProvider();
    await loginAs("first");

    const gate = deferred<void>();

    mockedDelete.mockImplementationOnce(async () => {
      await gate.promise;
      storedToken = null;
    });

    let pendingLogout!: Promise<Outcome>;

    await act(async () => {
      pendingLogout = observe(auth().logout());
    });

    mockedLogin.mockResolvedValueOnce({
      user: makeUser("second"),
      tokens: makeTokens("second"),
    });

    let pendingLogin!: Promise<Outcome>;

    await act(async () => {
      pendingLogin = observe(
        auth().login("second@example.test", "synthetic-password"),
      );
    });

    expect(mockedLogin).toHaveBeenCalledTimes(1);

    await act(async () => {
      gate.resolve(undefined);

      expect(await pendingLogout).toBe("resolved");
      expect(await pendingLogin).toBe("resolved");
    });

    expect(auth().user).toEqual(makeUser("second"));
    expect(auth().accessToken).toBe(makeTokens("second").accessToken);
    expect(storedToken).toBe(makeTokens("second").refreshToken);
  });

  it("does not restore a stored session when its initial refresh finishes after logout", async () => {
    storedToken = makeTokens("first").refreshToken;

    const gate = deferred<AuthTokens>();

    mockedRefresh.mockReturnValueOnce(gate.promise);

    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mockedRefresh).toHaveBeenCalledTimes(1);
    });

    await logout();

    await act(async () => {
      gate.resolve(makeTokens("stale"));
      await gate.promise;
    });

    expect(auth().loading).toBe(false);
    expect(auth().user).toBeNull();
    expect(auth().accessToken).toBeNull();
    expect(storedToken).toBeNull();

    expect(mockedSave).not.toHaveBeenCalled();
    expect(mockedCurrentUser).not.toHaveBeenCalled();
  });

  it("does not restore a user when the initial profile request finishes after logout", async () => {
    storedToken = makeTokens("first").refreshToken;

    const replacement = makeTokens("rotated");
    const gate = deferred<AuthUser>();

    mockedRefresh.mockResolvedValueOnce(replacement);
    mockedCurrentUser.mockReturnValueOnce(gate.promise);

    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mockedCurrentUser).toHaveBeenCalledWith(replacement.accessToken);
    });

    expect(storedToken).toBe(replacement.refreshToken);

    await logout();

    await act(async () => {
      gate.resolve(makeUser("first"));
      await gate.promise;
    });

    expect(auth().loading).toBe(false);
    expect(auth().user).toBeNull();
    expect(auth().accessToken).toBeNull();
    expect(storedToken).toBeNull();
  });

  it("starts a new refresh without sharing a previous session refresh", async () => {
    await mountProvider();
    await loginAs("first");

    const oldGate = deferred<AuthTokens>();

    mockedRefresh.mockReturnValueOnce(oldGate.promise);

    let previous!: Promise<Outcome>;

    await act(async () => {
      previous = observe(auth().refreshAccessToken());
    });

    await waitFor(() => {
      expect(mockedRefresh).toHaveBeenCalledTimes(1);
    });

    await logout();
    await loginAs("second");

    const replacement = makeTokens("second-rotated");

    mockedRefresh.mockResolvedValueOnce(replacement);

    await act(async () => {
      expect(await auth().refreshAccessToken()).toBe(replacement.accessToken);
    });

    expect(mockedRefresh).toHaveBeenCalledTimes(2);

    expect(mockedRefresh).toHaveBeenNthCalledWith(
      2,
      makeTokens("second").refreshToken,
    );

    await act(async () => {
      oldGate.resolve(makeTokens("stale"));
      expect(await previous).toBe("rejected");
    });

    expect(auth().user).toEqual(makeUser("second"));
    expect(auth().accessToken).toBe(replacement.accessToken);
    expect(storedToken).toBe(replacement.refreshToken);
  });

  it("rejects a successful response belonging to a previous session", async () => {
    await mountProvider();
    await loginAs("first");

    const gate = deferred<string>();

    const request = jest
      .fn<Promise<string>, [string]>()
      .mockReturnValueOnce(gate.promise);

    let pending!: Promise<Outcome>;

    await act(async () => {
      pending = observe(auth().runAuthenticatedRequest(request));
    });

    expect(request).toHaveBeenCalledWith(makeTokens("first").accessToken);

    await logout();
    await loginAs("second");

    await act(async () => {
      gate.resolve("previous-session-data");

      expect(await pending).toBe("rejected");
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(auth().user).toEqual(makeUser("second"));
    expect(storedToken).toBe(makeTokens("second").refreshToken);
  });

  it("does not invalidate a new session when an older retry fails", async () => {
    await mountProvider();
    await loginAs("first");

    const gate = deferred<string>();

    const invalidAccess = new ApiClientError(
      "Invalid access token.",
      401,
      "invalid_access_token",
    );

    mockedRefresh.mockResolvedValueOnce(makeTokens("first-rotated"));

    const request = jest
      .fn<Promise<string>, [string]>()
      .mockRejectedValueOnce(invalidAccess)
      .mockReturnValueOnce(gate.promise);

    let pending!: Promise<Outcome>;

    await act(async () => {
      pending = observe(auth().runAuthenticatedRequest(request));
    });

    await waitFor(() => {
      expect(request).toHaveBeenCalledTimes(2);
    });

    expect(request).toHaveBeenNthCalledWith(
      2,
      makeTokens("first-rotated").accessToken,
    );

    await logout();
    await loginAs("second");

    await act(async () => {
      gate.reject(invalidAccess);

      expect(await pending).toBe("rejected");
    });

    expect(auth().user).toEqual(makeUser("second"));
    expect(auth().accessToken).toBe(makeTokens("second").accessToken);
    expect(storedToken).toBe(makeTokens("second").refreshToken);
  });

  it("rejects refresh requests after logout without contacting the backend", async () => {
    await mountProvider();
    await loginAs("first");

    await logout();

    await expect(auth().refreshAccessToken()).rejects.toThrow();

    expect(mockedRefresh).not.toHaveBeenCalled();
    expect(auth().user).toBeNull();
    expect(auth().accessToken).toBeNull();
    expect(storedToken).toBeNull();
  });

  it("revokes the session by refresh token without requiring a valid access token", async () => {
    await mountProvider();
    await loginAs("first");

    mockedLogout.mockRejectedValueOnce(
      new ApiClientError("Invalid access token.", 401, "invalid_access_token"),
    );

    await logout();

    expect(mockedLogoutByRefresh).toHaveBeenCalledTimes(1);

    expect(mockedLogoutByRefresh).toHaveBeenCalledWith(
      makeTokens("first").refreshToken,
    );

    expect(mockedLogout).not.toHaveBeenCalled();
    expect(mockedRefresh).not.toHaveBeenCalled();

    expect(storedToken).toBeNull();
    expect(auth().user).toBeNull();
    expect(auth().accessToken).toBeNull();
  });

  it("revokes the stored session when logout interrupts initial restoration", async () => {
    storedToken = makeTokens("first").refreshToken;

    const gate = deferred<AuthTokens>();

    mockedRefresh.mockReturnValueOnce(gate.promise);

    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mockedRefresh).toHaveBeenCalledTimes(1);
    });

    await logout();

    await act(async () => {
      gate.resolve(makeTokens("stale"));
      await gate.promise;
    });

    expect(mockedLogoutByRefresh).toHaveBeenCalledWith(
      makeTokens("first").refreshToken,
    );

    expect(mockedLogout).not.toHaveBeenCalled();

    expect(auth().loading).toBe(false);
    expect(auth().user).toBeNull();
    expect(auth().accessToken).toBeNull();
    expect(storedToken).toBeNull();
  });

  it("falls back to bearer logout when refresh-token revocation fails", async () => {
    await mountProvider();
    await loginAs("first");

    mockedLogoutByRefresh.mockRejectedValueOnce(
      new Error("Refresh logout unavailable."),
    );

    await logout();

    expect(mockedLogoutByRefresh).toHaveBeenCalledWith(
      makeTokens("first").refreshToken,
    );

    expect(mockedLogout).toHaveBeenCalledTimes(1);

    expect(mockedLogout).toHaveBeenCalledWith(makeTokens("first").accessToken);

    expect(storedToken).toBeNull();
    expect(auth().user).toBeNull();
  });

  it("falls back to bearer logout when secure storage cannot be read", async () => {
    await mountProvider();
    await loginAs("first");

    mockedGet.mockClear();

    mockedGet.mockRejectedValueOnce(new Error("Secure storage unavailable."));

    await logout();

    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(mockedLogoutByRefresh).not.toHaveBeenCalled();

    expect(mockedLogout).toHaveBeenCalledWith(makeTokens("first").accessToken);

    expect(storedToken).toBeNull();
    expect(auth().user).toBeNull();
    expect(auth().accessToken).toBeNull();
  });

  it("revokes credentials returned by a discarded login", async () => {
    await mountProvider();

    const gate = deferred<{
      user: AuthUser;
      tokens: AuthTokens;
    }>();

    mockedLogin.mockReturnValueOnce(gate.promise);

    let pending!: Promise<Outcome>;

    await act(async () => {
      pending = observe(
        auth().login("first@example.test", "synthetic-password"),
      );
    });

    await waitFor(() => {
      expect(mockedLogin).toHaveBeenCalledTimes(1);
    });

    await logout();
    await loginAs("second");

    await act(async () => {
      gate.resolve({
        user: makeUser("first"),
        tokens: makeTokens("discarded"),
      });

      expect(await pending).toBe("rejected");
    });

    expect(mockedLogoutByRefresh).toHaveBeenCalledWith(
      makeTokens("discarded").refreshToken,
    );

    expect(mockedLogoutByRefresh).not.toHaveBeenCalledWith(
      makeTokens("second").refreshToken,
    );

    expect(auth().user).toEqual(makeUser("second"));
    expect(auth().accessToken).toBe(makeTokens("second").accessToken);
    expect(storedToken).toBe(makeTokens("second").refreshToken);
  });

  it("revokes credentials returned by a discarded registration", async () => {
    await mountProvider();

    const gate = deferred<{
      user: AuthUser;
      tokens: AuthTokens;
    }>();

    mockedRegister.mockReturnValueOnce(gate.promise);

    let pending!: Promise<Outcome>;

    await act(async () => {
      pending = observe(
        auth().register(
          "First User",
          "first@example.test",
          "synthetic-password",
        ),
      );
    });

    await waitFor(() => {
      expect(mockedRegister).toHaveBeenCalledTimes(1);
    });

    await logout();

    await act(async () => {
      gate.resolve({
        user: makeUser("first"),
        tokens: makeTokens("discarded"),
      });

      expect(await pending).toBe("rejected");
    });

    expect(mockedLogoutByRefresh).toHaveBeenCalledWith(
      makeTokens("discarded").refreshToken,
    );

    expect(auth().user).toBeNull();
    expect(auth().accessToken).toBeNull();
    expect(storedToken).toBeNull();
  });

  it("clears local credentials when both remote logout methods are unavailable", async () => {
    await mountProvider();
    await loginAs("first");

    mockedLogoutByRefresh.mockRejectedValueOnce(
      new Error("Backend unavailable."),
    );

    mockedLogout.mockRejectedValueOnce(new Error("Backend unavailable."));

    await logout();

    expect(mockedLogoutByRefresh).toHaveBeenCalledWith(
      makeTokens("first").refreshToken,
    );

    expect(mockedLogout).toHaveBeenCalledWith(makeTokens("first").accessToken);

    expect(storedToken).toBeNull();
    expect(auth().user).toBeNull();
    expect(auth().accessToken).toBeNull();
  });

  it("revokes the remote session when local token deletion fails", async () => {
    await mountProvider();
    await loginAs("first");

    mockedDelete.mockRejectedValueOnce(
      new Error("SecureStore deletion failed."),
    );

    await logout();

    expect(mockedLogoutByRefresh).toHaveBeenCalledWith(
      makeTokens("first").refreshToken,
    );

    expect(storedToken).toBe(makeTokens("first").refreshToken);
    expect(auth().user).toBeNull();
    expect(auth().accessToken).toBeNull();
  });

  it("reports failure when neither local deletion nor remote revocation succeeds", async () => {
    await mountProvider();
    await loginAs("first");

    mockedDelete.mockRejectedValueOnce(
      new Error("SecureStore deletion failed."),
    );

    mockedLogoutByRefresh.mockRejectedValueOnce(
      new Error("Backend unavailable."),
    );

    mockedLogout.mockRejectedValueOnce(new Error("Backend unavailable."));

    await act(async () => {
      await expect(auth().logout()).rejects.toThrow(
        "N?o foi poss?vel encerrar a sess?o com seguran?a.",
      );
    });

    expect(storedToken).toBe(makeTokens("first").refreshToken);
    expect(auth().user).toBeNull();
    expect(auth().accessToken).toBeNull();
  });

  it("preserves a newer login while previous remote revocation is pending", async () => {
    await mountProvider();
    await loginAs("first");

    const gate = deferred<void>();

    mockedLogoutByRefresh.mockReturnValueOnce(gate.promise);

    let pendingLogout!: Promise<Outcome>;

    await act(async () => {
      pendingLogout = observe(auth().logout());
    });

    await waitFor(() => {
      expect(mockedLogoutByRefresh).toHaveBeenCalledWith(
        makeTokens("first").refreshToken,
      );
    });

    expect(storedToken).toBeNull();

    await loginAs("second");

    await act(async () => {
      gate.resolve(undefined);

      expect(await pendingLogout).toBe("resolved");
    });

    expect(auth().user).toEqual(makeUser("second"));
    expect(auth().accessToken).toBe(makeTokens("second").accessToken);
    expect(storedToken).toBe(makeTokens("second").refreshToken);

    expect(mockedLogoutByRefresh).not.toHaveBeenCalledWith(
      makeTokens("second").refreshToken,
    );
  });

  it("revokes newly issued login credentials when secure storage cannot save them", async () => {
    await mountProvider();

    const tokens = makeTokens("first");

    mockedLogin.mockResolvedValueOnce({
      user: makeUser("first"),
      tokens,
    });

    mockedSave.mockRejectedValueOnce(new Error("SecureStore write failed."));

    await act(async () => {
      await expect(
        auth().login("first@example.test", "synthetic-password"),
      ).rejects.toThrow();
    });

    expect(mockedLogoutByRefresh).toHaveBeenCalledWith(tokens.refreshToken);

    expect(storedToken).toBeNull();
    expect(auth().user).toBeNull();
    expect(auth().accessToken).toBeNull();
  });

  it("revokes rotated credentials when secure storage cannot save them", async () => {
    await mountProvider();
    await loginAs("first");

    const replacement = makeTokens("rotated");

    mockedRefresh.mockResolvedValueOnce(replacement);

    mockedSave.mockRejectedValueOnce(new Error("SecureStore write failed."));

    await act(async () => {
      await expect(auth().refreshAccessToken()).rejects.toThrow();
    });

    expect(auth().user).toBeNull();
    expect(auth().accessToken).toBeNull();
    expect(storedToken).toBeNull();

    expect(mockedLogoutByRefresh).toHaveBeenCalledWith(
      replacement.refreshToken,
    );
  });

  it("revokes restored credentials when loading the authenticated user fails", async () => {
    storedToken = makeTokens("first").refreshToken;

    const replacement = makeTokens("rotated");

    mockedRefresh.mockResolvedValueOnce(replacement);

    mockedCurrentUser.mockRejectedValueOnce(
      new Error("Profile request failed."),
    );

    await mountProvider();

    await waitFor(() => {
      expect(storedToken).toBeNull();
    });

    expect(auth().user).toBeNull();
    expect(auth().accessToken).toBeNull();

    await waitFor(() => {
      expect(mockedLogoutByRefresh).toHaveBeenCalledWith(
        replacement.refreshToken,
      );
    });
  });

  it("attempts remote revocation of late refresh credentials after an unsuccessful remote logout", async () => {
    await mountProvider();
    await loginAs("first");

    const gate = deferred<AuthTokens>();

    mockedRefresh.mockReturnValueOnce(gate.promise);

    let pendingRefresh!: Promise<Outcome>;

    await act(async () => {
      pendingRefresh = observe(auth().refreshAccessToken());
    });

    await waitFor(() => {
      expect(mockedRefresh).toHaveBeenCalledTimes(1);
    });

    mockedLogoutByRefresh.mockRejectedValueOnce(
      new Error("Backend temporarily unavailable."),
    );

    mockedLogout.mockRejectedValueOnce(
      new Error("Backend temporarily unavailable."),
    );

    await logout();

    const replacement = makeTokens("late");

    await act(async () => {
      gate.resolve(replacement);

      expect(await pendingRefresh).toBe("rejected");
    });

    expect(auth().user).toBeNull();
    expect(auth().accessToken).toBeNull();
    expect(storedToken).toBeNull();

    expect(mockedLogoutByRefresh).toHaveBeenCalledWith(
      replacement.refreshToken,
    );
  });
});
