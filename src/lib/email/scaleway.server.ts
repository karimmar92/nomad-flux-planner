/**
 * Scaleway Transactional Email (TEM) client. Server only.
 *
 * WHY SCALEWAY AND NOT THE OBVIOUS CHOICE. The alert this sends says things
 * like "you have used 76 of your 90 Schengen days". That is travel history
 * attached to a named person: where they have been and when. It is the most
 * sensitive data this product holds, and the landing page states plainly that
 * we host in the EU. Routing it through a US processor would need standard
 * contractual clauses, a new sub-processor entry in the privacy policy, and it
 * would quietly undercut the claim people trusted when they signed up.
 * Scaleway is French infrastructure, so the data stays where we said it would.
 *
 * ── SETUP THIS FILE ASSUMES ────────────────────────────────────────────
 *
 * Nothing here works until the sending domain is verified with SPF, DKIM and
 * DMARC records. That is not a formality: an unverified domain lands overstay
 * warnings in spam, and a warning nobody sees is worse than no warning at all,
 * because the person believes they are covered.
 *
 * Environment, all set in the platform project settings and never in .env
 * (which IS tracked in git in this repo):
 *
 *   SCALEWAY_SECRET_KEY   API secret key with TransactionalEmailFullAccess
 *   SCALEWAY_PROJECT_ID   Project the verified domain belongs to
 *   SCALEWAY_TEM_REGION   Region, e.g. fr-par. Defaults to fr-par.
 *   ALERT_FROM_EMAIL      Must be on the verified domain, or TEM rejects it
 *   ALERT_FROM_NAME       Display name
 *
 * API shape, from the Scaleway docs:
 *   POST https://api.scaleway.com/transactional-email/v1alpha1/regions/{region}/emails
 *   Header: X-Auth-Token: <secret key>
 *   Body:   { from: {name,email}, to: [{name,email}], subject, text, html, project_id }
 *   https://www.scaleway.com/en/docs/transactional-email/api-cli/send-emails-with-api/
 */

const DEFAULT_REGION = "fr-par";

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    // Fail loudly and by name. A silent no-op here means alerts stop and
    // nobody finds out until a customer overstays and asks why we said nothing.
    throw new Error(`${key} is not set. Transactional email cannot be sent.`);
  }
  return value;
}

export type EmailAddress = { name?: string; email: string };

export type SendEmailInput = {
  to: EmailAddress;
  subject: string;
  /** Always required. A text part is what keeps the message out of spam. */
  text: string;
  html?: string;
};

export type SendEmailResult = { id: string | null };

/**
 * Sends one email. Throws on any non-2xx so the caller can record the failure
 * against the user rather than assuming delivery.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const region = process.env["SCALEWAY_TEM_REGION"] || DEFAULT_REGION;
  const secret = required("SCALEWAY_SECRET_KEY");
  const projectId = required("SCALEWAY_PROJECT_ID");
  const fromEmail = required("ALERT_FROM_EMAIL");
  const fromName = process.env["ALERT_FROM_NAME"] || "Driftly";

  const body = {
    from: { name: fromName, email: fromEmail },
    to: [
      input.to.name ? { name: input.to.name, email: input.to.email } : { email: input.to.email },
    ],
    subject: input.subject,
    text: input.text,
    ...(input.html ? { html: input.html } : {}),
    project_id: projectId,
  };

  const res = await fetch(
    `https://api.scaleway.com/transactional-email/v1alpha1/regions/${region}/emails`,
    {
      method: "POST",
      headers: {
        "X-Auth-Token": secret,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    // Include the status and body: TEM's rejections are specific and useful
    // ("domain not verified", "sender not allowed"), and swallowing them turns
    // a five-minute DNS fix into an afternoon.
    const detail = await res.text().catch(() => "");
    throw new Error(`Scaleway TEM ${res.status}: ${detail.slice(0, 500)}`);
  }

  const json = (await res.json().catch(() => null)) as { emails?: { id?: string }[] } | null;
  return { id: json?.emails?.[0]?.id ?? null };
}
