"use client";

import { useSearchParams } from "next/navigation";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { z } from "zod";

import { safeJSONParse } from "../../../utils";
import type { NestedConstraints } from "./types";
import { cleanUrlParams } from "./utils/clean-url-params/clean-url-params";
import { evaluateConstraints } from "./utils/evaluate-dynamic-params-constraints/evaluate-dynamic-params-constraints";
import { validateWithSchema } from "./utils/validate-with-schema/validate-with-schema";

export interface UsePageParamsOptions<T extends Record<string, unknown>> {
  defaultParams?: T;
  schema?: z.ZodType<T>;
}

export interface UsePageParamsReturn<T extends Record<string, unknown>> {
  // states
  isLoading: boolean;
  params: T;

  // Utility functions
  setParams: Dispatch<SetStateAction<T>>;

  /**
   * Evaluate dynamic constraints against current params during render.
   *
   * Call this AFTER data that feeds into constraints is available (e.g. after a
   * query hook). If any constraint is violated, `registerDynamicParamsGuard` corrects the params via
   * React's "setState during render" pattern — the current render is discarded
   * and React immediately re-renders with corrected params.
   *
   * @example
   * ```tsx
   * const { params, registerDynamicParamsGuard } = usePageParams({...});
   * const { totalPages, isLoading } = useQuery({...params...});
   * registerDynamicParamsGuard({
   *   table: { page: cap(isLoading ? undefined : totalPages) },
   * });
   * ```
   */
  registerDynamicParamsGuard: (constraints: NestedConstraints<T>) => {
    wasReset: boolean;
  };
}

export function usePageParams<T extends Record<string, unknown>>({
  defaultParams = {} as T,
  schema,
}: UsePageParamsOptions<T>): UsePageParamsReturn<T> {
  const searchParams = useSearchParams();

  // Parse URL params during render to avoid timing gaps
  // useMemo ensures state initializes with actual URL values immediately,
  // eliminating race conditions that occur with useEffect's async timing
  const initialParams = useMemo<T>(() => {
    const _params = { ...defaultParams } as T;
    const allowedKeys = new Set(Object.keys(defaultParams));

    if (!searchParams) {
      return schema
        ? validateWithSchema(_params, schema, defaultParams)
        : _params;
    }

    searchParams.forEach((value, rawKey) => {
      if (!allowedKeys.has(rawKey)) return; //drop junk key

      const key = rawKey as keyof T;

      // Handle empty values
      if (value === "" || value === undefined) {
        // Arrays must remain arrays
        if (
          typeof defaultParams[key] === "object" &&
          defaultParams[key] !== null
        ) {
          _params[key] = (
            Array.isArray(defaultParams[key]) ? [] : {}
          ) as T[keyof T];
        }

        return;
      }

      if (typeof defaultParams[key] === "object") {
        // Handle arrays properly - don't spread them into objects
        if (Array.isArray(defaultParams[key])) {
          const defaultArray = defaultParams[key] as unknown[];
          const parsedArray = safeJSONParse(value, defaultArray);
          _params[key] = (
            Array.isArray(parsedArray) ? parsedArray : defaultArray
          ) as T[keyof T];
        } else {
          const parsedValue = safeJSONParse(value, {});
          _params[key] = {
            ..._params[key]!,
            ...parsedValue,
          };
        }
      } else {
        _params[key] = value as T[keyof T];
      }
    });

    return schema
      ? validateWithSchema(_params, schema, defaultParams)
      : _params;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [isLoading, setIsLoading] = useState(true);
  const [params, setParams] = useState<T>(initialParams);

  // Wrap setParams to validate before updating
  // If schema is provided, validates the new params and rejects invalid updates
  const setParamsValidated: Dispatch<SetStateAction<T>> = useCallback(
    (action) => {
      setParams((prev) => {
        const next = typeof action === "function" ? action(prev) : action;
        if (schema) {
          const validated = validateWithSchema(next, schema, prev);
          return validated;
        }
        return next;
      });
    },
    [schema]
  );

  // Tracks the params snapshot we've already issued a correction for, so repeated
  // guard calls within the same render (and re-renders before params settles) don't
  // stack corrections. Keyed off the params reference instead of a per-render reset,
  // which would require an illegal ref write during render.
  const correctedParamsRef = useRef<T | null>(null);

  const registerDynamicParamsGuard = useCallback(
    (constraints: NestedConstraints<T>): { wasReset: boolean } => {
      // Already corrected for the current params snapshot — wait for the re-render.
      if (correctedParamsRef.current === params) {
        return { wasReset: false };
      }

      const { corrected, needsCorrection } = evaluateConstraints(
        params,
        constraints
      );

      if (needsCorrection) {
        correctedParamsRef.current = params;
        // Use raw setParams — corrections are trusted; skip schema validation to avoid
        // schema vs. constraint precedence conflicts.
        setParams(corrected);
        return { wasReset: true };
      }

      return { wasReset: false };
    },
    [params]
  );

  // Update URL params when params change.
  // The URL sync is synchronous, so the loading toggle is intentional and safe here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setIsLoading(true);
    // fetch new search params to create empty params object for clean URL
    const newSearchParams = new URLSearchParams();

    const cleanedParams = cleanUrlParams(
      newSearchParams,
      params,
      defaultParams
    );

    // Use window.history.replaceState to update URL without triggering navigation
    const currentUrl = window.location.pathname + window.location.search;
    const newFullUrl =
      window.location.pathname + `?${cleanedParams.toString()}`;
    if (currentUrl !== newFullUrl) {
      window.history.replaceState(null, "", newFullUrl);
    }
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return {
    params,
    isLoading,
    setParams: setParamsValidated,
    registerDynamicParamsGuard,
  };
}
