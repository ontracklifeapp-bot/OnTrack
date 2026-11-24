import * as Sentry from "@sentry/react";
import { ReactNode } from "react";

// Website error tracking (Sentry). Only the live site reports — never local development.
// Privacy: no names, emails, IP addresses or task content are sent (dataCollection below),
// only the technical error, the page path and browser type. See the Privacy Policy.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (!__DEV__ && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    // Collect no personal data: no user info, cookies, headers, request bodies or query strings
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    environment: "production",
    // Calendar feed links contain a private token — never send it
    beforeSend(event) {
      if (event.request?.url) event.request.url = event.request.url.replace(/\/ical\/[a-f0-9]+/, "/ical/[token]");
      return event;
    },
  });
}

// Shown instead of a blank screen if something crashes while drawing the page
function Fallback() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "#0d0d1a", color: "#f0f0f0", fontFamily: "-apple-system, Helvetica, Arial, sans-serif", padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 44 }}>😕</div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>Something went wrong</div>
      <div style={{ color: "#aaa", maxWidth: 360 }}>We&apos;ve been notified and will look into it. Reloading usually fixes it.</div>
      <button onClick={() => window.location.reload()} style={{ marginTop: 8, background: "#6C63FF", color: "#fff", border: 0, borderRadius: 12, padding: "12px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Reload OnTrack</button>
    </div>
  );
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return <Sentry.ErrorBoundary fallback={<Fallback />}>{children}</Sentry.ErrorBoundary>;
}

// Report a handled error (e.g. a save that failed) without crashing
export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (!__DEV__) Sentry.captureException(error, context ? { extra: context } : undefined);
}
