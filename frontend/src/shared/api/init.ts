"use client";

import { api } from "./client";
import { addDevLogging, addSentryTracking } from "./plugins";

let initialized = false;

/**
 * Initialize the API client with plugins
 * This should be called once in the app layout
 */
export function initializeApi() {
  if (initialized || typeof window === "undefined") {
    return;
  }

  // Add Sentry tracking if available
  if (process.env.NEXT_PUBLIC_SENTRY_DSN && window.Sentry) {
    addSentryTracking(api);
  }

  // Add dev logging in development
  if (process.env.NODE_ENV === "development") {
    addDevLogging(api);
  }

  initialized = true;
}
