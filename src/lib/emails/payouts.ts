// Organization payout emails — sent to the org's Owners/Administrators (the
// roles that can withdraw), never to staff without MANAGE_PAYMENTS.
import { pool } from "@/lib/db";
import { formatPrice } from "@/lib/format-price";
import { resend, FROM, layout, ctaButton, detail, detailTable, escapeHtml as esc, BASE_URL } from "./_shared";

async function payoutRecipients(organizationId: string): Promise<{ orgName: string; emails: string[] }> {
  const [org, members] = await Promise.all([
    pool.query(`SELECT name FROM "organization" WHERE id = $1`, [organizationId]),
    pool.query(
      `SELECT DISTINCT u.email FROM "organization_membership" om JOIN "user" u ON u.id = om."userId"
       WHERE om."organizationId" = $1 AND om.status = 'active' AND om.role IN ('OWNER', 'ADMINISTRATOR') AND u.email IS NOT NULL`,
      [organizationId]
    ),
  ]);
  return { orgName: org.rows[0]?.name ?? "your organization", emails: members.rows.map((r) => r.email as string) };
}

async function sendToPayoutRecipients(organizationId: string, subject: (orgName: string) => string, body: (orgName: string) => string) {
  const { orgName, emails } = await payoutRecipients(organizationId);
  if (emails.length === 0) return;
  const html = layout(body(orgName));
  await Promise.all(emails.map((to) => resend.emails.send({ from: FROM, to, subject: subject(orgName), html }).catch(() => {})));
}

const earningsLink = () => ctaButton(`${BASE_URL}/organizer/payments`, "Open Earnings");
const heading = (eyebrow: string, title: string) =>
  `<p style="margin:0 0 6px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#e21d12;">${eyebrow}</p>
   <h1 style="margin:0 0 20px;font-size:22px;font-weight:900;color:#18181b;">${title}</h1>`;
const para = (text: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46;">${text}</p>`;

export function sendWithdrawalSentEmail(organizationId: string, amountCents: number, arrivalDate: Date | null) {
  return sendToPayoutRecipients(
    organizationId,
    () => `Your ${formatPrice(amountCents)} payout is on its way`,
    (orgName) =>
      heading("Payout sent", `${formatPrice(amountCents)} is on its way to your bank`) +
      para(`We've sent ${esc(orgName)}'s withdrawal to its bank account.`) +
      detailTable(
        detail("💸", "Amount", formatPrice(amountCents)),
        detail("📅", "Expected by", arrivalDate ? arrivalDate.toLocaleDateString("en-CA", { dateStyle: "long" }) : "1-3 business days")
      ) +
      earningsLink()
  );
}

export function sendWithdrawalDepositedEmail(organizationId: string, amountCents: number) {
  return sendToPayoutRecipients(
    organizationId,
    () => `${formatPrice(amountCents)} deposited in your bank account`,
    (orgName) =>
      heading("Payout deposited", `${formatPrice(amountCents)} has arrived`) +
      para(`${esc(orgName)}'s bank confirmed the deposit. Nothing else to do.`) +
      earningsLink()
  );
}

export function sendPayoutNeedsActionEmail(organizationId: string, amountCents: number, reason: string) {
  return sendToPayoutRecipients(
    organizationId,
    () => `Action needed to receive your ${formatPrice(amountCents)} payout`,
    () =>
      heading("Action needed", "Your bank couldn't receive your payout") +
      para(
        `Your ${formatPrice(amountCents)} is safe — it's being held for you, not lost. ${reason} Update your bank account on the Earnings page and we'll send it again automatically.`
      ) +
      ctaButton(`${BASE_URL}/organizer/payments`, "Update bank account")
  );
}

export function sendFundsAvailableEmail(organizationId: string, amountCents: number, eventTitles: string[]) {
  return sendToPayoutRecipients(
    organizationId,
    () => `${formatPrice(amountCents)} is ready to withdraw`,
    () =>
      heading("Funds available", `${formatPrice(amountCents)} is ready to withdraw`) +
      para(`The 48-hour hold has ended for ${eventTitles.map((t) => `<strong>${esc(t)}</strong>`).join(", ")}. You can withdraw it to your bank now.`) +
      ctaButton(`${BASE_URL}/organizer/payments`, "Withdraw")
  );
}
