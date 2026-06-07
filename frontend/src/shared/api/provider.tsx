"use client";

import { useEffect } from "react";

import { initializeApi } from "./init";

export function ApiProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initializeApi();
  }, []);

  return <>{children}</>;
}
