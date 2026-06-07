/**
 * Lightweight API wrapper for consistent error handling and optional instrumentation
 * This provides a clean abstraction over fetch without requiring Sentry dependencies
 */
import { API_URL } from "@/config/env";

export interface ApiError extends Error {
  status: number;
  response?: unknown;
}

export interface ApiConfig {
  baseURL?: string;
  headers?: Record<string, string>;
  timeout?: number;
  /** Credentials mode for every request. Defaults to "include" so the BFF session cookie is sent cross-origin. */
  credentials?: RequestCredentials;
}

/** Extended options for API methods that support per-request timeout */
export interface ApiRequestOptions extends RequestInit {
  /** Override the default timeout for this request (in ms) */
  timeout?: number;
}

class ApiClient {
  private config: ApiConfig;

  constructor(config: ApiConfig = {}) {
    this.config = {
      baseURL: "",
      headers: {},
      timeout: 30000,
      credentials: "include",
      ...config,
    };
  }

  async fetch(url: string, options: ApiRequestOptions = {}): Promise<Response> {
    const fullURL = `${this.config.baseURL}${url}`;

    // Extract custom timeout, use config default if not specified
    const { timeout: requestTimeout, ...fetchOptions } = options;
    const timeoutMs = requestTimeout ?? this.config.timeout!;

    // Create abort controller for timeout
    const controller = new AbortController();
    let isTimeoutAbort = false;
    const timeoutId = setTimeout(() => {
      isTimeoutAbort = true;
      controller.abort();
    }, timeoutMs);

    // Merge custom signal if provided
    let onUserAbort: (() => void) | undefined;
    if (fetchOptions.signal) {
      // Handle already-aborted signals
      if (fetchOptions.signal.aborted) {
        clearTimeout(timeoutId);
        controller.abort();
      } else {
        onUserAbort = () => controller.abort();
        fetchOptions.signal.addEventListener("abort", onUserAbort);
      }
    }

    try {
      const response = await fetch(fullURL, {
        credentials: this.config.credentials,
        ...fetchOptions,
        headers: {
          ...this.config.headers,
          ...fetchOptions.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = new Error(
          `API Error: ${response.statusText || response.status}`
        ) as ApiError;
        error.status = response.status;

        // Try to parse error response
        try {
          const contentType = response.headers.get("content-type");
          if (contentType?.includes("application/json")) {
            error.response = await response.json();
          } else {
            error.response = await response.text();
          }
        } catch {
          // Ignore parsing errors
        }

        throw error;
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort errors - distinguish timeout from user-initiated
      if (error instanceof Error && error.name === "AbortError") {
        if (isTimeoutAbort) {
          const timeoutError = new Error("Request timeout") as ApiError;
          timeoutError.status = 0;
          throw timeoutError;
        }
        // Re-throw user-initiated abort as-is
        throw error;
      }

      throw error;
    } finally {
      // Clean up event listener to prevent memory leaks
      if (onUserAbort && fetchOptions.signal) {
        fetchOptions.signal.removeEventListener("abort", onUserAbort);
      }
    }
  }

  // Convenience methods
  async get<T = unknown>(url: string, options?: ApiRequestOptions): Promise<T> {
    const response = await this.fetch(url, {
      ...options,
      method: "GET",
    });
    return response.json();
  }

  async post<T = unknown>(
    url: string,
    body?: unknown,
    options?: ApiRequestOptions
  ): Promise<T> {
    const isFormData = body instanceof FormData;
    const response = await this.fetch(url, {
      ...options,
      method: "POST",
      headers: {
        // Only set Content-Type for JSON, let browser handle FormData
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...options?.headers,
      },
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    });
    return response.json();
  }

  async put<T = unknown>(
    url: string,
    body?: unknown,
    options?: ApiRequestOptions
  ): Promise<T> {
    const isFormData = body instanceof FormData;
    const response = await this.fetch(url, {
      ...options,
      method: "PUT",
      headers: {
        // Only set Content-Type for JSON, let browser handle FormData
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...options?.headers,
      },
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    });
    return response.json();
  }

  async patch<T = unknown>(
    url: string,
    body?: unknown,
    options?: ApiRequestOptions
  ): Promise<T> {
    const isFormData = body instanceof FormData;
    const response = await this.fetch(url, {
      ...options,
      method: "PATCH",
      headers: {
        // Only set Content-Type for JSON, let browser handle FormData
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...options?.headers,
      },
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    });
    return response.json();
  }

  async delete<T = unknown>(
    url: string,
    options?: ApiRequestOptions
  ): Promise<T> {
    const response = await this.fetch(url, {
      ...options,
      method: "DELETE",
    });
    // 204 No Content has no body — skip JSON parsing
    if (response.status === 204) return undefined as T;
    return response.json();
  }
}

// Export a default instance pointed at the backend, sending the session cookie.
// baseURL is read at module load (NEXT_PUBLIC_* is build-time inlined), so the very
// first request — e.g. /auth/me — already targets the backend with no init race.
export const api = new ApiClient({ baseURL: API_URL, credentials: "include" });

// Export the class for custom instances
export { ApiClient };

// Type guard for API errors
export function isApiError(error: unknown): error is ApiError {
  return error instanceof Error && "status" in error;
}

// Extract human-readable message from API errors, falling back to error.message or a default
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) {
    const body = error.response as { error?: string } | null;
    if (body?.error) return body.error;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
