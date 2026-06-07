/**
 * Plugin system for the API client to add optional instrumentation
 * This keeps monitoring concerns separate from the core API functionality
 */
import type { ApiClient, ApiError } from "./client";

interface SentrySpanOptions {
  op: string;
  name: string;
  attributes?: Record<string, unknown>;
}

interface SentryContext {
  level?: "info" | "warning" | "error";
  tags?: Record<string, string | number>;
  contexts?: Record<string, unknown>;
}

declare global {
  interface Window {
    Sentry?: {
      startSpan: <T>(options: SentrySpanOptions, callback: () => T) => T;
      captureException: (error: unknown, context?: SentryContext) => void;
      captureMessage: (message: string, context?: SentryContext) => void;
    };
  }
}

/**
 * Adds Sentry performance tracking and error capture to the API client
 * This is completely optional and only runs if Sentry is available
 */
export function addSentryTracking(apiClient: ApiClient): ApiClient {
  // Only add tracking on client-side
  if (typeof window === "undefined" || !window.Sentry) {
    return apiClient;
  }

  // Store original fetch method
  const originalFetch = apiClient.fetch.bind(apiClient);

  // Override fetch with instrumented version
  apiClient.fetch = async function (url: string, options: RequestInit = {}) {
    const method = options.method || "GET";

    return window.Sentry!.startSpan(
      {
        op: "http.client",
        name: `${method} ${url}`,
        attributes: {
          "http.method": method,
          "http.url": url,
        },
      },
      async () => {
        try {
          const response = await originalFetch(url, options);
          return response;
        } catch (error) {
          // Add additional context for errors
          if (error instanceof Error && "status" in error) {
            const apiError = error as ApiError;

            // Only capture 5xx errors as exceptions
            if (apiError.status >= 500) {
              window.Sentry!.captureException(error, {
                tags: {
                  api_endpoint: url,
                  api_method: method,
                  api_status: apiError.status,
                },
                contexts: {
                  api: {
                    url,
                    method,
                    status: apiError.status,
                    response: apiError.response,
                  },
                },
              });
            } else if (apiError.status >= 400) {
              // Log 4xx errors as messages (info level)
              window.Sentry!.captureMessage(
                `API ${apiError.status}: ${error.message}`,
                {
                  level: "info",
                  tags: {
                    api_endpoint: url,
                    api_method: method,
                    api_status: apiError.status,
                  },
                }
              );
            }
          }

          throw error;
        }
      }
    );
  };

  return apiClient;
}

/**
 * Plugin to add custom headers dynamically (e.g., auth tokens)
 */
export function addAuthHeaders(
  apiClient: ApiClient,
  getHeaders: () => Record<string, string> | Promise<Record<string, string>>
): ApiClient {
  const originalFetch = apiClient.fetch.bind(apiClient);

  apiClient.fetch = async function (url: string, options: RequestInit = {}) {
    const authHeaders = await getHeaders();

    return originalFetch(url, {
      ...options,
      headers: {
        ...authHeaders,
        ...options.headers,
      },
    });
  };

  return apiClient;
}

/**
 * Plugin to add request/response logging in development
 */
export function addDevLogging(apiClient: ApiClient): ApiClient {
  if (process.env.NODE_ENV !== "development") {
    return apiClient;
  }

  const originalFetch = apiClient.fetch.bind(apiClient);

  apiClient.fetch = async function (url: string, options: RequestInit = {}) {
    const method = options.method || "GET";
    console.log(`🔵 API Request: ${method} ${url}`);

    try {
      const response = await originalFetch(url, options);
      console.log(`🟢 API Response: ${method} ${url} - ${response.status}`);
      return response;
    } catch (error) {
      console.error(`🔴 API Error: ${method} ${url}`, error);
      throw error;
    }
  };

  return apiClient;
}
