/**
 * Nightly threshold-alert job.
 *
 * WHY IT IS AN HTTP ENDPOINT RATHER THAN A SCHEDULED FUNCTION. This project
 * has no pg_cron and no edge functions, and picking one would tie the job to
 * that choice. An endpoint is scheduler-agnostic: Supabase pg_cron with
 * pg_net, a scheduled edge function, GitHub Actions, or a hosted cron service
 * can all call it, and swapping between them later costs nothing.
 *
 * WHY /api/public/. It is the only prefix the platform proxy passes through
 * unauthenticated, the same constraint that dictates the Stripe webhook path.
 * "Public" here means "no session cookie", not "no authentication" — see below.
 *
 * ── SECURITY ───────────────────────────────────────────────────────────
 *
 * This route reads every paying user's travel history and sends them email.
 * It is protected by a shared secret in a header, compared in constant time so
 * the comparison itself cannot be used to recover the secret one byte at a
 * time. The secret is required, with no development fallback: a default value
 * is how a "temporary" opening becomes permanent.
 *
 * The route never accepts a user id or an email address from the caller. It
 * decides entirely from the database who is due an alert and where it goes, so
 * possession of the secret cannot be turned into "send arbitrary mail to an
 * arbitrary address from our verified domain".
 *
 * ── FAILURE POLICY ─────────────────────────────────────────────────────
 *
 * One user's failure must not stop the run, or a single bad address blocks
 * every warning behind it. Failures are recorded per user in alert_state and
 * the band is NOT advanced, so the next run retries rather than marking
 * somebody as warned when nothing was delivered.
 */
import { createFileRoute } from "@tanstack/react-router";
import { evaluateApplicable } from "@/lib/rules";
import { canUse } from "@/lib/entitlements";
import { alertSubject, bandFor, pendingAlerts, type AlertBand } from "@/lib/alerts/thresholds";
import { renderAlertEmail } from "@/lib/alerts/render";
import type { Plan, Trip } from "@/lib/types";

/** Constant-time compare. Length is intentionally leaked; contents are not. */
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type RunSummary = {
  considered: number;
  emailed: number;
  failed: number;
  skipped: number;
};

/** The three rows this job reads, named rather than left as loose records. */
type ProfileRow = { id: string; plan: string | null; nationality: string | null };
type AlertStateRow = { rule_id: string; last_band: number };

type Selected<T> = Promise<{ data: T[] | null; error: { message: string } | null }> & {
  eq: (col: string, val: string) => Promise<{ data: T[] | null }>;
};

/**
 * A deliberately narrow, hand-written view of the admin client.
 *
 * `alert_state` and `profiles.nationality` arrive with the migration in this
 * commit, and the generated Supabase types are derived from the live schema —
 * so until the migration runs and types are regenerated, TypeScript does not
 * believe these names exist. admin-billing.functions.ts casts for the same
 * reason.
 *
 * Written as named row types rather than Record<string, unknown> so the cast
 * still asserts a shape. A loose record would compile against any column name,
 * which turns a typo into a silent empty result at 3am instead of an error.
 * Remove this once types are regenerated; LAUNCH.md tracks it.
 */
type UntypedDb = {
  from: (table: string) => {
    select: {
      (cols: "id, plan, nationality"): Selected<ProfileRow>;
      (cols: "rule_id, last_band"): Selected<AlertStateRow>;
      (cols: string): Selected<Record<string, unknown>>;
    };
    upsert: (
      rows: Record<string, unknown> | Record<string, unknown>[],
      opts?: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  };
};

export const Route = createFileRoute("/api/public/alerts/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["ALERT_CRON_SECRET"];
        if (!expected) {
          console.error("ALERT_CRON_SECRET is not set; refusing to run the alert job.");
          return new Response("Not configured", { status: 503 });
        }
        const provided = request.headers.get("x-alert-secret") ?? "";
        if (!secretsMatch(provided, expected)) {
          return new Response("Forbidden", { status: 403 });
        }

        // Dynamic import inside the handler: a top-level import of the admin
        // client would bundle the service-role key toward the browser. There
        // is a test in server-only.test.ts that fails the build if this is
        // ever changed to a static import.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendEmail } = await import("@/lib/email/scaleway.server");

        /**
         * Untyped view of the admin client.
         *
         * `alert_state` and `profiles.nationality` arrive with the migration in
         * this commit, and the generated Supabase types are produced from the
         * live schema — so until the migration is applied and types are
         * regenerated, these names do not exist as far as TypeScript knows.
         * This is the same cast admin-billing.functions.ts uses for the same
         * reason, and it should be removed in both places once the types are
         * refreshed. LAUNCH.md tracks that as a checklist item.
         */
        const db = supabaseAdmin as unknown as UntypedDb;

        const today = new Date().toISOString().slice(0, 10);
        const summary: RunSummary = { considered: 0, emailed: 0, failed: 0, skipped: 0 };

        // Only plans that actually include alerts. Selecting on the plan here
        // rather than filtering later keeps the job from reading the travel
        // history of people who have not paid for this.
        const { data: profiles, error: profilesError } = await db
          .from("profiles")
          .select("id, plan, nationality");

        if (profilesError) {
          console.error("Alert job could not read profiles:", profilesError.message);
          return new Response("Database error", { status: 500 });
        }

        for (const profile of profiles ?? []) {
          const plan = (profile.plan ?? "free") as Plan;
          if (!canUse(plan, "threshold_alerts")) {
            summary.skipped++;
            continue;
          }
          summary.considered++;

          try {
            const { data: tripRows } = await db
              .from("trips")
              .select("id, country_code, city_id, entry_date, exit_date, purpose, notes")
              .eq("user_id", profile.id);

            const trips = (tripRows ?? []) as unknown as Trip[];
            if (trips.length === 0) {
              summary.skipped++;
              continue;
            }

            const results = evaluateApplicable({
              trips,
              today,
              ...(profile.nationality ? { passport: profile.nationality } : {}),
            });

            const { data: stateRows } = await db
              .from("alert_state")
              .select("rule_id, last_band")
              .eq("user_id", profile.id);

            const lastBands: Record<string, AlertBand> = {};
            for (const row of stateRows ?? []) {
              lastBands[row.rule_id] = row.last_band as AlertBand;
            }

            const due = pendingAlerts(results, lastBands);

            // Record every rule's current band, including ones that fell. A
            // fall is what re-arms the warning for the next climb, so skipping
            // it would silence the second crossing.
            const bandsNow = results
              .filter((r) => !r.higherIsBetter && r.status !== "insufficient_data")
              .map((r) => ({ ruleId: r.id, band: bandFor(r.value, r.threshold) }));

            if (due.length === 0) {
              await db.from("alert_state").upsert(
                bandsNow.map((b) => ({
                  user_id: profile.id,
                  rule_id: b.ruleId,
                  last_band: b.band,
                  updated_at: new Date().toISOString(),
                })),
                { onConflict: "user_id,rule_id" },
              );
              summary.skipped++;
              continue;
            }

            const { data: userData } = await supabaseAdmin.auth.admin.getUserById(profile.id);
            const email = userData?.user?.email;
            if (!email) {
              summary.skipped++;
              continue;
            }

            const { text, html } = renderAlertEmail(due);
            await sendEmail({ to: { email }, subject: alertSubject(due), text, html });

            // Advance the band only after a successful send.
            await db.from("alert_state").upsert(
              bandsNow.map((b) => ({
                user_id: profile.id,
                rule_id: b.ruleId,
                last_band: b.band,
                last_sent_at: due.some((d) => d.ruleId === b.ruleId)
                  ? new Date().toISOString()
                  : null,
                last_error: null,
                updated_at: new Date().toISOString(),
              })),
              { onConflict: "user_id,rule_id" },
            );
            summary.emailed++;
          } catch (e) {
            summary.failed++;
            const message = e instanceof Error ? e.message : String(e);
            console.error(`Alert job failed for ${profile.id}:`, message);
            // Band deliberately not advanced, so the next run retries.
            await db
              .from("alert_state")
              .upsert(
                { user_id: profile.id, rule_id: "_run", last_error: message.slice(0, 500) },
                { onConflict: "user_id,rule_id" },
              )
              .then(
                () => undefined,
                () => undefined,
              );
          }
        }

        console.warn("Alert run finished:", summary);
        return Response.json(summary);
      },
    },
  },
});
