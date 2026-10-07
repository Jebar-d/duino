"use client";

import type { ReactNode } from "react";

export function ActiveThemeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useThemeConfig() {
  return { activeTheme: "default", setActiveTheme: () => undefined };
}
