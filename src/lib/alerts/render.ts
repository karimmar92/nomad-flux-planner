/**
 * The alert email itself.
 *
 * Pure string building, no IO, so the wording is testable and reviewable
 * without sending anything.
 *
 * ── WHY IT LOOKS SO PLAIN ──────────────────────────────────────────────
 *
 * No logo, no banner image, no marketing footer. Three reasons, in order:
 *
 *   1. It has one job — get a number in front of somebody who needs to act on
 *      it — and every decorative element pushes that number further down.
 *   2. Image-heavy mail from a young domain is a deliverability problem. This
 *      warning is worthless in a spam folder, and worse than worthless,
 *      because the person believes they are being watched over.
 *   3. It is transactional, which is what keeps it lawful to send without
 *      marketing consent. Adding promotional content changes its legal
 *      character, so there is a real reason not to put an offer in it.
 *
 * A plain-text part is always produced. Text-only clients matter less than
 * they did, but a missing text part is a spam signal in itself.
 */
import { APP_NAME, absoluteUrl } from "@/lib/app";
import type { PendingAlert } from "./thresholds";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function line(a: PendingAlert): string {
  if (a.band === 100) {
    return `${a.label}: ${a.value} of ${a.threshold}. You are over the limit.`;
  }
  const left = Math.max(0, a.threshold - a.value);
  return `${a.label}: ${a.value} of ${a.threshold} used, ${left} left.`;
}

export function renderAlertEmail(alerts: PendingAlert[]): { text: string; html: string } {
  const trackerUrl = absoluteUrl("/tracker");
  const lines = alerts.map(line);

  // The opening sentence states why this arrived. People who forgot they
  // enabled something are the ones most likely to mark it as spam.
  const preamble =
    alerts.length === 1
      ? `A count you asked ${APP_NAME} to watch has crossed a threshold.`
      : `Some counts you asked ${APP_NAME} to watch have crossed a threshold.`;

  const text = [
    preamble,
    "",
    ...lines.map((l) => `  ${l}`),
    "",
    `These are counted from the trips you logged. If any of them are wrong, the numbers will be too: ${trackerUrl}`,
    "",
    `You are receiving this because threshold alerts are part of your ${APP_NAME} plan. Turn them off in your profile.`,
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111">
  <p style="margin:0 0 16px">${escapeHtml(preamble)}</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px">
    ${alerts
      .map(
        (a) =>
          `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${escapeHtml(line(a))}</td></tr>`,
      )
      .join("\n    ")}
  </table>
  <p style="margin:0 0 20px">
    <a href="${escapeHtml(trackerUrl)}" style="background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;display:inline-block">Check your days</a>
  </p>
  <p style="margin:0 0 8px;color:#555;font-size:13px">
    These are counted from the trips you logged. If any of them are wrong, the numbers will be too.
  </p>
  <p style="margin:0;color:#777;font-size:12px">
    You are receiving this because threshold alerts are part of your ${escapeHtml(APP_NAME)} plan. Turn them off in your profile.
  </p>
</body></html>`;

  return { text, html };
}
