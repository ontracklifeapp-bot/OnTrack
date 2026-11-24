import { ReactNode } from "react";

// Phone app: error tracking isn't set up yet (the website uses errorTracking.web.tsx).
export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function reportError(_error: unknown, _context?: Record<string, unknown>) {}
