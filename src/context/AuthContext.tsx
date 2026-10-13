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

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const accessTokenRef = useRef<string | null>(null);
  const refreshPromiseRef = useRef<Promise<string> | null>(null);

  const updateAccessToken = useCallback((token: string | null): void => {
    accessTokenRef.current = token;
    setAccessToken(token);
  }, []);

  const updateAuthenticatedUser = useCallback(
    (authenticatedUser: AuthUser): void => {
      setUser(authenticatedUser);
    },
    [],
  );

  const clearAuthenticationState = useCallback((): void => {
    updateAccessToken(null);
    setUser(null);
  }, [updateAccessToken]);

  useEffect(() => {
    let active = true;

    async function restoreSession(): Promise<void> {
      try {
        await clearLegacyAuthStorage();

        const storedRefreshToken = await getRefreshToken();

        if (!storedRefreshToken) {
          return;
        }

        const tokens = await refreshSession(storedRefreshToken);

        await saveRefreshToken(tokens.refreshToken);

        const currentUser = await getCurrentUser(tokens.accessToken);

        if (!active) {
          return;
        }

        updateAccessToken(tokens.accessToken);
        updateAuthenticatedUser(currentUser);
      } catch {
        await deleteRefreshToken().catch(() => undefined);

        if (active) {
          clearAuthenticationState();
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void restoreSession();

    return () => {
      active = false;
    };
  }, [clearAuthenticationState, updateAccessToken, updateAuthenticatedUser]);

  async function persistAuthentication(
    authenticatedUser: AuthUser,
    tokens: AuthTokens,
  ): Promise<void> {
    await saveRefreshToken(tokens.refreshToken);

    updateAccessToken(tokens.accessToken);
    updateAuthenticatedUser(authenticatedUser);
  }

  async function login(email: string, password: string): Promise<void> {
    try {
      const result = await loginAccount(email.trim().toLowerCase(), password);

      await persistAuthentication(result.user, result.tokens);
    } catch (error) {
      throw normalizeAuthError(error);
    }
  }

  async function register(
    name: string,
    email: string,
    password: string,
  ): Promise<void> {
    try {
      const normalizedName = name.trim().replace(/\s+/g, " ");

      const result = await registerAccount(
        normalizedName,
        email.trim().toLowerCase(),
        password,
      );

      await persistAuthentication(result.user, result.tokens);
    } catch (error) {
      throw normalizeAuthError(error);
    }
  }

  const performAccessTokenRefresh = useCallback(async (): Promise<string> => {
    const storedRefreshToken = await getRefreshToken();

    if (!storedRefreshToken) {
      clearAuthenticationState();

      throw new Error("Sua sessão expirou. Entre novamente.");
    }

    try {
      const tokens = await refreshSession(storedRefreshToken);

      await saveRefreshToken(tokens.refreshToken);

      updateAccessToken(tokens.accessToken);

      return tokens.accessToken;
    } catch (error) {
      await deleteRefreshToken().catch(() => undefined);

      clearAuthenticationState();

      throw normalizeAuthError(error);
    }
  }, [clearAuthenticationState, updateAccessToken]);

  const refreshAccessToken = useCallback(async (): Promise<string> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const refreshPromise = performAccessTokenRefresh();

    refreshPromiseRef.current = refreshPromise;

    try {
      return await refreshPromise;
    } finally {
      if (refreshPromiseRef.current === refreshPromise) {
        refreshPromiseRef.current = null;
      }
    }
  }, [performAccessTokenRefresh]);

  const runAuthenticatedRequest = useCallback(
    async function runAuthenticatedRequest<T>(
      request: (accessToken: string) => Promise<T>,
    ): Promise<T> {
      const requestAccessToken = accessTokenRef.current;

      if (!requestAccessToken) {
        throw new Error("Sua sessão expirou. Entre novamente.");
      }

      try {
        return await request(requestAccessToken);
      } catch (error) {
        if (
          !(error instanceof ApiClientError) ||
          error.code !== "invalid_access_token"
        ) {
          throw error;
        }

        const latestAccessToken = accessTokenRef.current;

        if (latestAccessToken && latestAccessToken !== requestAccessToken) {
          return request(latestAccessToken);
        }

        const refreshedAccessToken = await refreshAccessToken();

        try {
          return await request(refreshedAccessToken);
        } catch (retryError) {
          if (
            retryError instanceof ApiClientError &&
            retryError.code === "invalid_access_token"
          ) {
            await deleteRefreshToken().catch(() => undefined);
            clearAuthenticationState();
          }

          throw retryError;
        }
      }
    },
    [clearAuthenticationState, refreshAccessToken],
  );

  async function logout(): Promise<void> {
    const currentAccessToken = accessTokenRef.current;

    clearAuthenticationState();

    let backendLogoutSucceeded = false;

    try {
      if (currentAccessToken) {
        await logoutSession(currentAccessToken);

        backendLogoutSucceeded = true;
      }
    } catch {
      backendLogoutSucceeded = false;
    }

    try {
      await deleteRefreshToken();
    } catch {
      if (!backendLogoutSucceeded) {
        throw new Error("Não foi possível encerrar a sessão com segurança.");
      }
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
