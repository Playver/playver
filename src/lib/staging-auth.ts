// Staging's HTTP Basic Auth gate (APP_ENV=staging + STAGING_BASIC_AUTH_*),
// shared by proxy.ts (every page) and the few API routes that return data
// staging shouldn't hand to strangers (e.g. /api/search). Browsers resend
// the credentials automatically on same-origin fetches once a page is
// unlocked, so the app's own requests pass.
export function stagingAuthOk(request: Request): boolean {
  const user = process.env.STAGING_BASIC_AUTH_USER;
  const pass = process.env.STAGING_BASIC_AUTH_PASSWORD;
  if (process.env.APP_ENV !== "staging" || !user || !pass) return true;
  const authHeader = request.headers.get("authorization");
  const provided = authHeader?.startsWith("Basic ") ? atob(authHeader.slice(6)) : null;
  return provided === `${user}:${pass}`;
}
