import { environment } from "../config/environment";

const REQUEST_TIMEOUT_MS = 10_000;

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

interface ApiRequestOptions extends Omit<RequestInit, "body" | "method"> {
  body?: unknown;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null = null,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${environment.apiUrl}${normalizedPath}`;
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type");

  if (!contentType?.includes("application/json")) {
    return null;
  }

  return response.json();
}

function getErrorDetails(payload: unknown): {
  code: string | null;
  message: string;
} {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const { error } = payload as ApiErrorBody;

    if (error && typeof error === "object") {
      return {
        code: typeof error.code === "string" ? error.code : null,
        message:
          typeof error.message === "string"
            ? error.message
            : "The request could not be completed.",
      };
    }
  }

  return {
    code: null,
    message: "The request could not be completed.",
  };
}

async function request<T>(
  method: string,
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(buildUrl(path), {
      ...options,
      method,
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    const payload = await parseResponse(response);

    if (!response.ok) {
      const error = getErrorDetails(payload);

      throw new ApiClientError(error.message, response.status, error.code);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The request timed out.");
    }

    throw new Error("The backend could not be reached.");
  } finally {
    clearTimeout(timeoutId);
  }
}

export const apiClient = {
  get<T>(path: string): Promise<T> {
    return request<T>("GET", path);
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("POST", path, { body });
  },

  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("PUT", path, { body });
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("PATCH", path, { body });
  },

  delete<T>(path: string): Promise<T> {
    return request<T>("DELETE", path);
  },
};
