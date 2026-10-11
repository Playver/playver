// Shared Resend client + HTML-email building blocks used by every file in
// src/lib/emails/. `layout()` wraps a template's inner HTML in the common
// card/logo/footer shell; `ctaButton()`/`detail()`/`detailTable()` are small
// reusable pieces for buttons and label/value rows (e.g. event date, price).
// Individual templates (account.ts, organization.ts, event/, team/,
// tournament/) each own their own copy/subject and just call these helpers.
import { Resend } from "resend";

// EMAIL_MODE=log (set only in staging's Vercel env) swaps the real Resend
// client for a no-op that logs instead of sending — so testing on staging
// never emails real people. Every send*Email function only does
// `await resend.emails.send(...)` and never uses the return value, so this
// stub's shape doesn't need to match Resend's real response type exactly.
const guarded = process.env.EMAIL_MODE === "log";
export const resend = guarded
  ? ({
      emails: {
        send: async (payload: unknown) => {
          console.log("[EMAIL_MODE=log] would send:", payload);
          return { data: { id: "guarded-noop" }, error: null };
        },
      },
    } as unknown as Resend)
  : // Falls back to an obviously-fake key rather than leaving it undefined —
    // Resend's constructor throws on a missing key, and this module is
    // imported by routes pulled into every Vercel build's page-data-
    // collection step, so that throw would fail the entire build on any
    // deployment without RESEND_API_KEY set (see the analogous fix in
    // src/lib/stripe.ts for the same reasoning).
    new Resend(process.env.RESEND_API_KEY || "re_not_configured");
export const FROM = "Playver <noreply@playver.ca>";
export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://playver.ca";

export function layout(body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Playver</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <!-- Logo bar -->
        <tr><td style="padding-bottom:28px;text-align:center;">
          <span style="font-size:26px;font-weight:900;color:#e21d12;letter-spacing:-0.5px;">Playver</span>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#ffffff;border-radius:20px;padding:40px 36px;box-shadow:0 2px 8px rgba(0,0,0,0.07);">
          ${body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:24px;text-align:center;font-size:12px;color:#a1a1aa;">
          © ${new Date().getFullYear()} Playver · <a href="${BASE_URL}" style="color:#a1a1aa;">playver.ca</a>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// For user-entered text (org names, event titles) interpolated into HTML.
export function escapeHtml(v: string) {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function ctaButton(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:28px;padding:14px 28px;background:#e21d12;color:#fff;font-weight:700;font-size:14px;border-radius:10px;text-decoration:none;">${label}</a>`;
}

export function detail(icon: string, label: string, value: string) {
  return `<tr>
    <td style="padding:7px 0;vertical-align:top;">
      <span style="font-size:16px;margin-right:10px;">${icon}</span>
      <span style="font-size:13px;color:#71717a;font-weight:600;text-transform:uppercase;letter-spacing:.04em;">${label}</span>
    </td>
    <td style="padding:7px 0;vertical-align:top;text-align:right;">
      <span style="font-size:14px;color:#18181b;font-weight:600;">${value}</span>
    </td>
  </tr>`;
}

export function detailTable(...rows: string[]) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f4f4f5;border-bottom:1px solid #f4f4f5;margin-bottom:8px;">${rows.join("")}</table>`;
}
