// Next 16 renamed middleware.ts to proxy.ts — this is that file, not a
// custom reverse proxy. Two jobs: (1) next-intl's locale-detection/
// redirect middleware (e.g. "/" -> "/en" or "/fr" based on the visitor's
// Accept-Language / cookie); (2) on staging only (APP_ENV=staging), an
// HTTP Basic Auth gate — noindex/robots.txt (src/lib/env.ts) only stops
// search engines, not people who have the URL, so this is the actual
// access control keeping staging from being wide open to anyone who
// finds it. The matcher excludes _next, /api, and any path with a file
// extension, so API routes — including the Stripe webhook, which can't
// answer a login prompt — and static assets skip both middlewares
// entirely.
import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { stagingAuthOk } from "./lib/staging-auth";

const intlMiddleware = createMiddleware(routing);

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Playver Staging"' },
  });
}

export default function middleware(request: NextRequest) {
  if (!stagingAuthOk(request)) return unauthorized();
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
