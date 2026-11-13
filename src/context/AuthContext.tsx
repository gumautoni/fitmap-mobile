import {
  createContext,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getCurrentUser,
  loginAccount,
  logoutSession,
  logoutSessionByRefreshToken,
  refreshSession,
  registerAccount,
  type AuthTokens,
  type AuthUser,
} from "../services/auth";
import { ApiClientError } from "../services/apiClient";
import {
  clearLegacyAuthStorage,
  deleteRefreshToken,
  getRefreshToken,
  saveRefreshToken,
} from "../services/authStorage";

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<string>;
  runAuthenticatedRequest: <T>(
    request: (accessToken: string) => Promise<T>,
  ) => Promise<T>;
  updateAuthenticatedUser: (user: AuthUser) => void;
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeAuthError(error: unknown): Error {
  if (error instanceof ApiClientError) {
    switch (error.code) {
      case "invalid_credentials":
        return new Error("E-mail ou senha inválidos.");

      case "account_already_exists":
        return new Error("Já existe uma conta cadastrada com este e-mail.");

      case "invalid_access_token":
      case "invalid_refresh_token":
        return new Error("Sua sessão expirou. Entre novamente.");

      case "request_validation_error":
        return new Error("Confira os dados informados e tente novamente.");

      default:
        return new Error("Não foi possível concluir a solicitação.");
    }
  }

  if (error instanceof Error) {
    if (error.message === "The backend could not be reached.") {
      return new Error("Não foi possível conectar ao servidor.");
    }

    if (error.message === "The request timed out.") {
      return new Error("A conexão com o servidor demorou mais que o esperado.");
    }
  }

  return new Error("Não foi possível concluir a solicitação.");
}

async function revokeRemoteSession(
  refreshToken: string | null,
  accessToken: string | null,
): Promise<boolean> {
  if (refreshToken) {
    try {
      await logoutSessionByRefreshToken(refreshToken);

      return true;
    } catch {
      // Preserve compatibility with bearer logout when available.
    }
  }

  if (accessToken) {
    try {
      await logoutSession(accessToken);

      return true;
    } catch {
      // Remote revocation cannot be guaranteed when the API is unavailable.
    }
  }

  return false;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const accessTokenRef = useRef<string | null>(null);
  const refreshPromiseRef = useRef<Promise<string> | null>(null);
  const generationRef = useRef(0);
  const storageQueueRef = useRef<Promise<void>>(Promise.resolve());

  const isCurrentGeneration = useCallback((generation: number): boolean => {
    return generationRef.current === generation;
  }, []);

  const assertCurrentGeneration = useCallback(
    (generation: number): void => {
      if (!isCurrentGeneration(generation)) {
        throw new Error("Sua sess?o expirou. Entre novamente.");
      }
    },
    [isCurrentGeneration],
  );

  const invalidateGeneration = useCallback((): number => {
    generationRef.current += 1;
    refreshPromiseRef.current = null;

    return generationRef.current;
  }, []);

  const enqueueStorage = useCallback(function enqueueStorage<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    const pending = storageQueueRef.current.then(operation);

    storageQueueRef.current = pending.then(
      () => undefined,
      () => undefined,
    );

    return pending;
  }, []);

  const updateAccessToken = useCallback((token: string | null): void => {
    accessTokenRef.current = token;
    setAccessToken(token);
  }, []);

  const updateAuthenticatedUser = useCallback(
    (authenticatedUser: AuthUser): void => {
      setUser((previousUser) =>
        previousUser?.id === authenticatedUser.id
          ? authenticatedUser
          : previousUser,
      );
    },
    [],
  );

  const clearAuthenticationState = useCallback((): void => {
    updateAccessToken(null);
    setUser(null);
  }, [updateAccessToken]);

  const clearCurrentSession = useCallback(
    async (generation: number): Promise<void> => {
      if (!isCurrentGeneration(generation)) {
        return;
      }

      invalidateGeneration();
      clearAuthenticationState();
      setLoading(false);

      await enqueueStorage(deleteRefreshToken).catch(() => undefined);
    },
    [
      clearAuthenticationState,
      enqueueStorage,
      invalidateGeneration,
      isCurrentGeneration,
    ],
  );

  const readSessionToken = useCallback(
    async (generation: number): Promise<string | null> => {
      const token = await enqueueStorage(async () => {
        assertCurrentGeneration(generation);
        return getRefreshToken();
      });

      assertCurrentGeneration(generation);

      return token;
    },
    [assertCurrentGeneration, enqueueStorage],
  );

  const saveSessionTokens = useCallback(
    async (generation: number, tokens: AuthTokens): Promise<void> => {
      await enqueueStorage(async () => {
        assertCurrentGeneration(generation);

        await saveRefreshToken(tokens.refreshToken);
      });

      assertCurrentGeneration(generation);
    },
    [assertCurrentGeneration, enqueueStorage],
  );

  useEffect(() => {
    const generation = generationRef.current;

    async function restoreSession(): Promise<void> {
      let issuedTokens: AuthTokens | null = null;

      try {
        await clearLegacyAuthStorage();

        assertCurrentGeneration(generation);

        const storedRefreshToken = await readSessionToken(generation);

        assertCurrentGeneration(generation);

        if (!storedRefreshToken) {
          return;
        }

        const tokens = await refreshSession(storedRefreshToken);

        issuedTokens = tokens;

        assertCurrentGeneration(generation);

        await saveSessionTokens(generation, tokens);

        assertCurrentGeneration(generation);

        const currentUser = await getCurrentUser(tokens.accessToken);

        assertCurrentGeneration(generation);

        updateAccessToken(tokens.accessToken);
        setUser(currentUser);
      } catch {
        await clearCurrentSession(generation);

        // A failed or obsolete restoration must not leave newly
        // issued credentials active when remote revocation is available.
        if (issuedTokens) {
          await revokeRemoteSession(
            issuedTokens.refreshToken,
            issuedTokens.accessToken,
          );
        }
      } finally {
        if (isCurrentGeneration(generation)) {
          setLoading(false);
        }
      }
    }

    void restoreSession();

    return () => {
      invalidateGeneration();
    };
  }, [
    assertCurrentGeneration,
    clearCurrentSession,
    invalidateGeneration,
    isCurrentGeneration,
    readSessionToken,
    saveSessionTokens,
    updateAccessToken,
  ]);

  async function authenticate(
    operation: () => Promise<{
      user: AuthUser;
      tokens: AuthTokens;
    }>,
  ): Promise<void> {
    const generation = invalidateGeneration();

    clearAuthenticationState();
    setLoading(false);

    let issuedTokens: AuthTokens | null = null;

    try {
      await enqueueStorage(deleteRefreshToken);

      assertCurrentGeneration(generation);

      const result = await operation();

      issuedTokens = result.tokens;

      assertCurrentGeneration(generation);

      await saveSessionTokens(generation, result.tokens);

      assertCurrentGeneration(generation);

      updateAccessToken(result.tokens.accessToken);
      setUser(result.user);
    } catch (error) {
      const currentGeneration = isCurrentGeneration(generation);

      if (currentGeneration) {
        await clearCurrentSession(generation);
      }

      // Revoke credentials that were issued but never became an
      // accepted local session. Do not touch the newer session's storage.
      if (issuedTokens) {
        await revokeRemoteSession(
          issuedTokens.refreshToken,
          issuedTokens.accessToken,
        );
      }

      if (!currentGeneration) {
        throw new Error("Sua sess?o expirou. Entre novamente.");
      }

      throw normalizeAuthError(error);
    }
  }

  async function login(email: string, password: string): Promise<void> {
    await authenticate(() =>
      loginAccount(email.trim().toLowerCase(), password),
    );
  }

  async function register(
    name: string,
    email: string,
    password: string,
  ): Promise<void> {
    const normalizedName = name.trim().replace(/\s+/g, " ");

    await authenticate(() =>
      registerAccount(normalizedName, email.trim().toLowerCase(), password),
    );
  }

  const performAccessTokenRefresh = useCallback(
    async (generation: number): Promise<string> => {
      let issuedTokens: AuthTokens | null = null;

      try {
        const storedRefreshToken = await readSessionToken(generation);

        assertCurrentGeneration(generation);

        if (!storedRefreshToken) {
          throw new Error("Sua sess?o expirou. Entre novamente.");
        }

        const tokens = await refreshSession(storedRefreshToken);

        issuedTokens = tokens;

        assertCurrentGeneration(generation);

        await saveSessionTokens(generation, tokens);

        assertCurrentGeneration(generation);

        updateAccessToken(tokens.accessToken);

        return tokens.accessToken;
      } catch (error) {
        const currentGeneration = isCurrentGeneration(generation);

        if (currentGeneration) {
          await clearCurrentSession(generation);
        }

        // Revoke credentials received by a failed or stale refresh.
        // Never modify storage belonging to a newer generation.
        if (issuedTokens) {
          await revokeRemoteSession(
            issuedTokens.refreshToken,
            issuedTokens.accessToken,
          );
        }

        if (!currentGeneration) {
          throw new Error("Sua sess?o expirou. Entre novamente.");
        }

        throw normalizeAuthError(error);
      }
    },
    [
      assertCurrentGeneration,
      clearCurrentSession,
      isCurrentGeneration,
      readSessionToken,
      saveSessionTokens,
      updateAccessToken,
    ],
  );

  const refreshAccessToken = useCallback(async (): Promise<string> => {
    if (!accessTokenRef.current) {
      throw new Error("Sua sess?o expirou. Entre novamente.");
    }

    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const generation = generationRef.current;
    const refreshPromise = performAccessTokenRefresh(generation);

    refreshPromiseRef.current = refreshPromise;

    try {
      const token = await refreshPromise;

      assertCurrentGeneration(generation);

      return token;
    } finally {
      if (refreshPromiseRef.current === refreshPromise) {
        refreshPromiseRef.current = null;
      }
    }
  }, [assertCurrentGeneration, performAccessTokenRefresh]);

  const runAuthenticatedRequest = useCallback(
    async function runAuthenticatedRequest<T>(
      request: (accessToken: string) => Promise<T>,
    ): Promise<T> {
      const generation = generationRef.current;
      const requestAccessToken = accessTokenRef.current;

      if (!requestAccessToken) {
        throw new Error("Sua sess?o expirou. Entre novamente.");
      }

      async function execute(token: string): Promise<T> {
        assertCurrentGeneration(generation);

        const result = await request(token);

        assertCurrentGeneration(generation);

        return result;
      }

      try {
        return await execute(requestAccessToken);
      } catch (error) {
        assertCurrentGeneration(generation);

        if (
          !(error instanceof ApiClientError) ||
          error.code !== "invalid_access_token"
        ) {
          throw error;
        }

        const latestAccessToken = accessTokenRef.current;

        const retryToken =
          latestAccessToken && latestAccessToken !== requestAccessToken
            ? latestAccessToken
            : await refreshAccessToken();

        assertCurrentGeneration(generation);

        try {
          return await execute(retryToken);
        } catch (retryError) {
          assertCurrentGeneration(generation);

          if (
            retryError instanceof ApiClientError &&
            retryError.code === "invalid_access_token"
          ) {
            await clearCurrentSession(generation);
          }

          throw retryError;
        }
      }
    },
    [assertCurrentGeneration, clearCurrentSession, refreshAccessToken],
  );

  async function logout(): Promise<void> {
    const currentAccessToken = accessTokenRef.current;

    invalidateGeneration();
    clearAuthenticationState();
    setLoading(false);

    // Capture and delete within one queue operation. A later login
    // cannot persist its credentials between these two storage actions.
    const { refreshToken, localDeletionSucceeded } = await enqueueStorage(
      async () => {
        let refreshToken: string | null = null;
        let localDeletionSucceeded = false;

        try {
          refreshToken = await getRefreshToken();
        } catch {
          // The bearer token remains available as a fallback.
        }

        try {
          await deleteRefreshToken();

          localDeletionSucceeded = true;
        } catch {
          // Remote revocation may still invalidate the stored credential.
        }

        return { refreshToken, localDeletionSucceeded };
      },
    );

    const backendLogoutSucceeded = await revokeRemoteSession(
      refreshToken,
      currentAccessToken,
    );

    if (!localDeletionSucceeded && !backendLogoutSucceeded) {
      throw new Error("N?o foi poss?vel encerrar a sess?o com seguran?a.");
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        loading,
        login,
        register,
        logout,
        refreshAccessToken,
        runAuthenticatedRequest,
        updateAuthenticatedUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
