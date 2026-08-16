/**
 * Stripe webhook — the only place commission is ever created.
 *
 * Accrual fires on `invoice.paid`, never on subscription creation: we only pay
 * commission on money actually collected. `charge.refunded` and
 * `charge.dispute.created` write a negative clawback row.
 *
 * IDEMPOTENCY IS LOAD-BEARING. Stripe retries webhooks. The database carries a
 * UNIQUE constraint on (stripe_invoice_id, type); a retry hits that constraint
 * and is swallowed as a no-op. Without it a retry silently double-credits a
 * creator and nobody notices until someone is overpaid.
 */

import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import {
  accrualAmountCents,
  availableAtFrom,
  capReached,
  hardBlock,
  softFlags,
  type LedgerRow,
} from "@/lib/referrals/commission";
import { CREATOR_PROGRAM } from "@/lib/referrals/config";

const DAY_MS = 86_400_000;

function verifySignature(payload: string, header: string | null, secret: string) {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k ?? "", v ?? ""];
    }),
  );
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/webhooks/stripe")({
  server: {
    handlers: {
      /**
       * The outer handler does signature checking and AUDIT LOGGING; the
       * decision logic lives in `handleEvent` below.
       *
       * Everything is logged, including events we ignore. When a customer says
       * "I paid and nothing happened", the useful answer is almost never in
       * Stripe's dashboard: Stripe shows a 200 and stops there. What matters is
       * what our handler decided, and that only exists if we write it down.
       *
       * Logging failures never fail the webhook. A 500 makes Stripe retry, and
       * retrying a payment that was processed correctly just because the audit
       * insert failed would be a worse bug than a missing log line.
       */
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        const body = await request.text();

        if (!secret) return new Response("Webhook not configured", { status: 503 });
        if (!verifySignature(body, request.headers.get("stripe-signature"), secret)) {
          // Deliberately NOT logged to the database. An unsigned request is
          // not a Stripe event, and writing attacker-controlled JSON into the
          // audit table is how the audit table stops being trustworthy.
          return new Response("Invalid signature", { status: 401 });
        }

        /**
         * `any` is deliberate here and confined to this one declaration.
         *
         * A Stripe event payload is a different shape per event type, nested
         * several levels deep, and the fields we read differ per branch below.
         * Typing it as `unknown` would mean a cast at every property access,
         * which is more unsafe code, not less. The safety comes from the
         * signature check above: nothing reaches this line unless Stripe signed
         * it.
         */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const event = JSON.parse(body) as { type: string; data: { object: Record<string, any> } };
        const object = event.data?.object ?? {};

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const eventId: string | null = (event as { id?: string }).id ?? null;
        const subjectUserId: string | null =
          object["metadata"]?.["user_id"] ?? object["client_reference_id"] ?? null;

        // Record arrival before doing anything. If the handler throws, the row
        // is already there and says `received`, which is exactly the state you
        // want to find when investigating.
        const { logWebhookReceived, logWebhookOutcome } = await import("@/lib/billing/webhook-log");
        if (eventId) {
          await logWebhookReceived(supabaseAdmin, {
            eventId,
            type: event.type,
            userId: subjectUserId,
            payload: event,
          });
        }

        async function finish(res: Response, outcome: Record<string, unknown>, failed = false) {
          if (eventId) {
            await logWebhookOutcome(supabaseAdmin, {
              eventId,
              userId: subjectUserId,
              outcome,
              failed,
            });
          }
          return res;
        }

        /**
         * Every exit from the handler goes through one of these two, so the
         * audit row always gets an outcome. Rewriting each `return` by hand
         * would guarantee that the one branch nobody thought about is the one
         * that stays silent, and that branch is always the interesting one.
         */
        const json = (outcome: Record<string, unknown>) => finish(Response.json(outcome), outcome);
        const fail = (message: string, status = 500) =>
          finish(new Response(message, { status }), { error: message }, true);

        /* ---------------- founding 100 ----------------
         *
         * MUST come before plan provisioning. A founding purchase is a
         * `checkout.session.completed` with mode=payment, and the block below
         * also handles that event type for subscriptions. If the subscription
         * branch runs first it finds no price id, logs "unmapped_price" and
         * returns, and the customer who just paid $99 gets nothing.
         *
         * Idempotency lives in the database: claim_founding_spot() keys on the
         * checkout session id, so a Stripe retry returns the same number
         * instead of burning a second spot.
         */
        if (
          event.type === "checkout.session.completed" &&
          object["mode"] === "payment" &&
          object["metadata"]?.["founding"] === "1"
        ) {
          const userId: string | null =
            object["metadata"]?.["user_id"] ?? object["client_reference_id"] ?? null;
          const sessionId: string | null = object["id"] ?? null;
          const paid = object["payment_status"] === "paid";

          if (!userId || !sessionId) {
            return json({ received: true, skipped: "no_user_reference" });
          }
          if (!paid) {
            // Delayed payment methods land here. Stripe sends another event
            // when the money actually arrives; granting now would give away a
            // permanent spot for a payment that may never complete.
            return json({ received: true, skipped: "not_paid_yet" });
          }

          const customerId: string | null =
            typeof object["customer"] === "string" ? object["customer"] : null;
          if (customerId) {
            await supabaseAdmin
              .from("profiles")
              .update({ stripe_customer_id: customerId })
              .eq("id", userId);
          }

          const { claimFoundingSpot } = await import("@/lib/founding/rpc");
          const { spot, error } = await claimFoundingSpot(supabaseAdmin, userId, sessionId);
          if (error) return fail(error);

          if (spot == null) {
            /**
             * Sold out between opening checkout and paying. The customer has
             * been charged for something that no longer exists, so this needs a
             * refund rather than a silent 200. Flagged loudly because it is a
             * money-owed situation, not a logging line.
             */
            return json({
              received: true,
              founding: "sold_out_after_payment",
              action_required: "REFUND",
              user_id: userId,
              session_id: sessionId,
            });
          }

          return json({ received: true, founding_number: spot, user_id: userId });
        }

        /* ---------------- plan provisioning ----------------
         *
         * Stripe is the source of truth for entitlement. `profiles.plan` is
         * write-protected against end users by a trigger (see
         * 20260806140000_security_linter_fixes.sql) precisely so that the only
         * way to hold a paid tier is to have paid — this handler, running as
         * service_role, is the sole writer.
         *
         * Downgrade on deletion is as important as upgrade on creation. A
         * cancelled subscription that leaves someone on Pro is revenue lost
         * silently and forever, because nobody complains about that bug.
         */
        if (
          event.type === "checkout.session.completed" ||
          event.type === "customer.subscription.created" ||
          event.type === "customer.subscription.updated" ||
          event.type === "customer.subscription.deleted"
        ) {
          const { planForPriceId } = await import("@/config/stripe-prices");

          const userId: string | null =
            object["metadata"]?.["user_id"] ?? object["client_reference_id"] ?? null;
          const customerId: string | null =
            typeof object["customer"] === "string" ? object["customer"] : null;
          if (!userId) return json({ received: true, skipped: "no_user_reference" });

          // Statuses that entitle. `past_due` deliberately still entitles:
          // a failed card retry should not lock someone out of their passport
          // vault mid-trip. Stripe cancels after its retry schedule, and the
          // deletion event below is what actually downgrades.
          const status: string = object["status"] ?? "active";
          const entitled = ["active", "trialing", "past_due"].includes(status);

          const priceId: string | null =
            object["items"]?.["data"]?.[0]?.["price"]?.["id"] ?? object["plan"]?.["id"] ?? null;

          const plan =
            event.type === "customer.subscription.deleted" || !entitled
              ? "free"
              : (priceId && planForPriceId(priceId)) ||
                (object["metadata"]?.["plan"] as string | undefined) ||
                null;

          if (!plan) {
            return json({ received: true, skipped: "unmapped_price", priceId });
          }

          const patch: { plan: string; stripe_customer_id?: string } = { plan };
          if (customerId) patch.stripe_customer_id = customerId;

          const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", userId);
          if (error) return fail(error.message);

          return json({ received: true, plan, user_id: userId });
        }

        /* ---------------- accrual ---------------- */
        if (event.type === "invoice.paid") {
          const invoiceId: string | null = object["id"] ?? null;
          const collected: number = object["amount_paid"] ?? 0;
          const referredUserId: string | null =
            object["metadata"]?.["user_id"] ??
            object["subscription_details"]?.["metadata"]?.["user_id"] ??
            null;

          if (!invoiceId || !referredUserId || collected <= 0) {
            return json({ received: true, skipped: "missing_reference" });
          }

          const { data: referred } = await supabaseAdmin
            .from("profiles")
            .select("id, referred_by, referral_program")
            .eq("id", referredUserId)
            .maybeSingle();

          // Attribution is locked to the profile at signup. No re-attribution here.
          if (!referred?.referred_by || referred.referral_program !== "creator") {
            return json({ received: true, skipped: "not_creator_attributed" });
          }

          const { data: creator } = await supabaseAdmin
            .from("creators")
            .select("id, user_id, status")
            .eq("user_id", referred.referred_by)
            .maybeSingle();
          if (!creator || creator.status !== "active") {
            return json({ received: true, skipped: "no_active_creator" });
          }

          const { data: creatorAuth } = await supabaseAdmin.auth.admin.getUserById(creator.user_id);
          const { data: referredAuth } = await supabaseAdmin.auth.admin.getUserById(referredUserId);

          const block = hardBlock({
            creatorUserId: creator.user_id,
            referredUserId,
            creatorEmail: creatorAuth?.user?.email ?? null,
            referredEmail: referredAuth?.user?.email ?? null,
            paymentFingerprint: object["payment_method_details"]?.["card"]?.["fingerprint"] ?? null,
            creatorPaymentFingerprints:
              (creatorAuth?.user?.user_metadata?.["payment_fingerprints"] as string[]) ?? [],
          });
          if (block) {
            await supabaseAdmin.from("fraud_flags").insert({
              creator_id: creator.id,
              referred_user_id: referredUserId,
              kind: "other",
              severity: "urgent",
              detail: { hard_block: block, invoice: invoiceId },
            });
            return json({ received: true, blocked: block });
          }

          const { data: existing } = await supabaseAdmin
            .from("commission_ledger")
            .select("*")
            .eq("creator_id", creator.id);
          const ledger = (existing ?? []) as LedgerRow[];

          if (capReached(ledger, referredUserId)) {
            return json({
              received: true,
              skipped: `cap_${CREATOR_PROGRAM.capMonthsPerReferredUser}_months`,
            });
          }

          const createdAt = new Date();
          const { error } = await supabaseAdmin.from("commission_ledger").insert({
            creator_id: creator.id,
            referred_user_id: referredUserId,
            type: "accrual",
            amount_cents: accrualAmountCents(collected),
            currency: object["currency"] ?? CREATOR_PROGRAM.currency,
            status: "pending",
            available_at: availableAtFrom(createdAt).toISOString(),
            stripe_invoice_id: invoiceId,
          });

          // Duplicate delivery: the unique constraint did its job.
          if (error && error.code === "23505") {
            return json({ received: true, duplicate: true });
          }
          if (error) return fail(error.message);

          // Soft flags accrue anyway and queue for a human. Shared coworking IPs
          // are normal for this audience and must never auto-reject.
          const since = new Date(Date.now() - 30 * DAY_MS).toISOString();
          const { data: referredProfiles } = await supabaseAdmin
            .from("profiles")
            .select("id, plan, created_at")
            .eq("referred_by", creator.user_id);
          const all = referredProfiles ?? [];
          const paid = all.filter((p) => p.plan !== "free").length;
          const last24h = all.filter((p) => Date.now() - Date.parse(p.created_at) < DAY_MS).length;
          const last30 = all.filter((p) => p.created_at >= since).length;

          for (const flag of softFlags({
            signupsFromSameIpLast24h: 0,
            conversionRate: all.length ? paid / all.length : 0,
            signupsLast24h: last24h,
            dailyBaselineLast30d: last30 / 30,
          })) {
            await supabaseAdmin.from("fraud_flags").insert({
              creator_id: creator.id,
              kind: flag.kind,
              detail: flag.detail,
            });
          }

          return json({ received: true, accrued: true });
        }

        /* ---------------- clawback ---------------- */
        if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
          const invoiceId: string | null =
            object["invoice"] ?? object["charge"]?.["invoice"] ?? null;
          if (!invoiceId) return json({ received: true, skipped: "no_invoice" });

          const { data: accrual } = await supabaseAdmin
            .from("commission_ledger")
            .select("*")
            .eq("stripe_invoice_id", invoiceId)
            .eq("type", "accrual")
            .maybeSingle();
          if (!accrual) return json({ received: true, skipped: "no_accrual" });

          const { error } = await supabaseAdmin.from("commission_ledger").insert({
            creator_id: accrual.creator_id,
            referred_user_id: accrual.referred_user_id,
            type: "clawback",
            amount_cents: -accrual.amount_cents,
            currency: accrual.currency,
            // Clawbacks bite immediately; if the accrual was already paid out the
            // creator carries a negative balance into their next payout.
            status: "available",
            available_at: new Date().toISOString(),
            stripe_invoice_id: invoiceId,
            note: `Clawback: ${event.type}`,
          });
          if (error && error.code === "23505") {
            return json({ received: true, duplicate: true });
          }
          if (error) return fail(error.message);

          return json({ received: true, clawed_back: true });
        }

        return json({ received: true, ignored: event.type });
      },
    },
  },
});
