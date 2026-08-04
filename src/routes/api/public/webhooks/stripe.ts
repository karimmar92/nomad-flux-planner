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
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        const body = await request.text();

        if (!secret) return new Response("Webhook not configured", { status: 503 });
        if (!verifySignature(body, request.headers.get("stripe-signature"), secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const event = JSON.parse(body) as {
          type: string;
          data: { object: Record<string, any> };
        };
        const object = event.data?.object ?? {};

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        /* ---------------- accrual ---------------- */
        if (event.type === "invoice.paid") {
          const invoiceId: string | null = object["id"] ?? null;
          const collected: number = object["amount_paid"] ?? 0;
          const referredUserId: string | null =
            object["metadata"]?.["user_id"] ?? object["subscription_details"]?.["metadata"]?.["user_id"] ?? null;

          if (!invoiceId || !referredUserId || collected <= 0) {
            return Response.json({ received: true, skipped: "missing_reference" });
          }

          const { data: referred } = await supabaseAdmin
            .from("profiles")
            .select("id, referred_by, referral_program")
            .eq("id", referredUserId)
            .maybeSingle();

          // Attribution is locked to the profile at signup. No re-attribution here.
          if (!referred?.referred_by || referred.referral_program !== "creator") {
            return Response.json({ received: true, skipped: "not_creator_attributed" });
          }

          const { data: creator } = await supabaseAdmin
            .from("creators")
            .select("id, user_id, status")
            .eq("user_id", referred.referred_by)
            .maybeSingle();
          if (!creator || creator.status !== "active") {
            return Response.json({ received: true, skipped: "no_active_creator" });
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
            return Response.json({ received: true, blocked: block });
          }

          const { data: existing } = await supabaseAdmin
            .from("commission_ledger")
            .select("*")
            .eq("creator_id", creator.id);
          const ledger = (existing ?? []) as LedgerRow[];

          if (capReached(ledger, referredUserId)) {
            return Response.json({
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
            return Response.json({ received: true, duplicate: true });
          }
          if (error) return new Response(error.message, { status: 500 });

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

          return Response.json({ received: true, accrued: true });
        }

        /* ---------------- clawback ---------------- */
        if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
          const invoiceId: string | null =
            object["invoice"] ?? object["charge"]?.["invoice"] ?? null;
          if (!invoiceId) return Response.json({ received: true, skipped: "no_invoice" });

          const { data: accrual } = await supabaseAdmin
            .from("commission_ledger")
            .select("*")
            .eq("stripe_invoice_id", invoiceId)
            .eq("type", "accrual")
            .maybeSingle();
          if (!accrual) return Response.json({ received: true, skipped: "no_accrual" });

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
            return Response.json({ received: true, duplicate: true });
          }
          if (error) return new Response(error.message, { status: 500 });

          return Response.json({ received: true, clawed_back: true });
        }

        return Response.json({ received: true, ignored: event.type });
      },
    },
  },
});
