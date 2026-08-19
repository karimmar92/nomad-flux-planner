/**
 * Payment webhook logic, kept out of the route file so it can be reasoned
 * about (and tested) on its own.
 *
 * Two responsibilities, deliberately in one place because they are driven by
 * the same events:
 *
 *  1. ENTITLEMENT. Stripe is the source of truth for what someone is paying
 *     for. `profiles.plan` is write-protected against end users by a trigger,
 *     so this handler — running as service_role — is the only writer. That is
 *     what makes "holding a paid tier" mean "has paid".
 *
 *  2. COMMISSION. Accrual fires on `invoice.paid` and never on subscription
 *     creation: commission is paid on money actually collected, not on money
 *     promised. Refunds and disputes write a negative clawback row.
 *
 * IDEMPOTENCY IS LOAD-BEARING. Stripe retries deliveries. Subscription state is
 * upserted on stripe_subscription_id, and the ledger carries a UNIQUE
 * constraint on (stripe_invoice_id, type) so a retry is swallowed as a no-op.
 * Without that, a retry double-credits a creator and nobody notices until
 * someone has been overpaid.
 *
 * Downgrade matters as much as upgrade: a cancelled subscription that leaves
 * someone on Pro is revenue lost silently, because nobody reports that bug.
 */
import {
  accrualAmountCents,
  availableAtFrom,
  capReached,
  hardBlock,
  softFlags,
  type LedgerRow,
} from "@/lib/referrals/commission";
import { CREATOR_PROGRAM } from "@/lib/referrals/config";
import { planForPriceId } from "@/config/stripe-prices";
import type { StripeEnv } from "@/lib/stripe.server";

const DAY_MS = 86_400_000;

export type StripeEvent = { type: string; data: { object: Record<string, any> } };

/** Statuses that keep access on.
 *
 * `past_due` still entitles on purpose: a failed card retry should not lock
 * someone out of their passport scans mid-trip. Stripe works through its retry
 * schedule and then cancels; the deletion event is what actually downgrades.
 */
const ENTITLING = ["active", "trialing", "past_due"];

/**
 * Resolve the human-readable price id. `lookup_key` is identical in test and
 * live; Stripe's internal price_xxx is not, so entitlement must never key off
 * it or gating works in preview and silently fails after publish.
 */
function priceKeyOf(object: Record<string, any>): string | null {
  const item = object["items"]?.["data"]?.[0];
  return (
    item?.["price"]?.["lookup_key"] ??
    item?.["price"]?.["metadata"]?.["lovable_external_id"] ??
    item?.["price"]?.["id"] ??
    object["plan"]?.["id"] ??
    object["metadata"]?.["price_lookup_key"] ??
    null
  );
}

function toIso(seconds: unknown): string | null {
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;
}

export async function handleStripeEvent(event: StripeEvent, env: StripeEnv): Promise<Response> {
  const object = event.data?.object ?? {};
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  /* ---------------- checkout completion (one-time + subscription) ---------------- */
  if (event.type === "checkout.session.completed") {
    const paymentStatus: string = object["payment_status"] ?? "";
    const mode: string = object["mode"] ?? "";

    // Delayed-notification methods (SEPA, and this audience uses it) fire this
    // when the payment is SUBMITTED, not when it settles. Granting access there
    // would hand out paid plans for payments that can still fail days later.
    if (paymentStatus === "unpaid") {
      return Response.json({ received: true, pending: "awaiting_settlement" });
    }

    const userId: string | null =
      object["metadata"]?.["user_id"] ??
      object["metadata"]?.["userId"] ??
      object["client_reference_id"] ??
      null;
    const customerId: string | null =
      typeof object["customer"] === "string" ? object["customer"] : null;
    if (!userId) return Response.json({ received: true, skipped: "no_user_reference" });

    // For subscription mode, the dedicated subscription events will create the
    // row in the subscriptions table and keep period dates current. We still
    // update the profile here from the session metadata so the user lands back
    // in the app with the right plan immediately, rather than waiting for the
    // subscription event that may arrive a few seconds later.
    // For payment mode (one-time, e.g. founding_lifetime), the session is the
    // only entitlement event we get, so we must write the profile here.
    const priceKey = priceKeyOf(object);
    /**
     * `metadata.founding === "1"` is checked FIRST and on its own.
     *
     * A founding session carries no `metadata.plan`, and a checkout.session
     * object has no expanded line items, so priceKeyOf() returns null: the
     * old code fell straight through to "unmapped_price" and the buyer paid
     * $99 for nothing. The founding flag is the only reliable marker here.
     */
    const isFounding = object["metadata"]?.["founding"] === "1";
    const plan = isFounding
      ? "founding_lifetime"
      : (object["metadata"]?.["plan"] as string | undefined) ||
        (priceKey && planForPriceId(priceKey)) ||
        null;

    if (!plan) return Response.json({ received: true, skipped: "unmapped_price", priceKey });


    /**
     * FOUNDING 100 — must not fall through to the generic plan write below.
     *
     * `plan` here is the literal price key, so a founding purchase produces
     * "founding_lifetime". Writing that into profiles.plan looks like it
     * works and silently breaks everything: entitlements only understand
     * free | starter | pro | teams, so PLAN_RANK["founding_lifetime"] is
     * undefined, every atLeast() check returns false, and tier() throws on
     * the profile page. The customer pays the founding price and unlocks less than the free
     * tier.
     *
     * claim_founding_spot() assigns the next number, enforces the 100 cap in
     * the database where a race cannot beat it, and sets plan to
     * 'founding_lifetime' itself. It is keyed on the checkout session id, so a Stripe retry
     * returns the number already issued instead of burning a second spot.
     */
    if (plan === "founding_lifetime") {
      const sessionId: string | null = object["id"] ?? null;
      const paid = object["payment_status"] === "paid";

      if (!sessionId) {
        return Response.json({ received: true, skipped: "no_session_id" });
      }
      if (!paid) {
        // Delayed payment methods land here. Stripe sends another event when
        // the money actually arrives. Granting a permanent spot now would
        // give one away for a payment that may never complete.
        return Response.json({ received: true, skipped: "not_paid_yet" });
      }

      if (customerId) {
        await supabaseAdmin
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("id", userId);
      }

      const { claimFoundingSpot } = await import("@/lib/founding/rpc");
      const { spot, error: claimError } = await claimFoundingSpot(supabaseAdmin, userId, sessionId);
      if (claimError) return new Response(claimError, { status: 500 });

      if (spot == null) {
        /**
         * Sold out between opening checkout and paying. Somebody has been
         * charged for something that no longer exists, so this is a refund,
         * not a log line. Returned loudly enough to be visible in the webhook
         * event list on /admin/billing.
         */
        return Response.json({
          received: true,
          founding: "sold_out_after_payment",
          action_required: "REFUND",
          user_id: userId,
          session_id: sessionId,
        });
      }

      return Response.json({
        received: true,
        founding_number: spot,
        plan: "founding_lifetime",
        user_id: userId,
      });
    }

    const patch: { plan: string; stripe_customer_id?: string } = { plan };
    if (customerId) patch.stripe_customer_id = customerId;

    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", userId);
    if (error) return new Response(error.message, { status: 500 });

    return Response.json({ received: true, plan, user_id: userId, mode });
  }

  /* ---------------- subscription lifecycle + entitlement ---------------- */
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const userId: string | null =
      object["metadata"]?.["user_id"] ??
      object["metadata"]?.["userId"] ??
      object["client_reference_id"] ??
      null;
    const customerId: string | null =
      typeof object["customer"] === "string" ? object["customer"] : null;
    if (!userId) return Response.json({ received: true, skipped: "no_user_reference" });

    const status: string = object["status"] ?? "active";
    const deleted = event.type === "customer.subscription.deleted";
    const entitled = !deleted && ENTITLING.includes(status);
    const priceKey = priceKeyOf(object);

    const plan = !entitled
      ? "free"
      : (priceKey && planForPriceId(priceKey)) ||
        (object["metadata"]?.["plan"] as string | undefined) ||
        null;

    if (!plan) return Response.json({ received: true, skipped: "unmapped_price", priceKey });

    /*
      THE TRIAL GRANTS PRO, whatever tier is being trialled.

      `subscriptions.plan` keeps the plan that will actually be billed — that
      row is the billing record and must not lie about what the customer
      bought. `profiles.plan` is the entitlement, and during a trial it is Pro.
      When the trial converts, Stripe sends the same event with status
      "active" and this branch stops applying, so entitlement drops back to
      the purchased tier on its own.
    */
    const entitlementPlan = status === "trialing" && plan !== "free" ? "pro" : plan;

    if (typeof object["id"] === "string") {
      const item = object["items"]?.["data"]?.[0];
      const { error: subError } = await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_subscription_id: object["id"],
          stripe_customer_id: customerId ?? "",
          product_id: item?.["price"]?.["product"] ?? null,
          price_id: priceKey,
          plan,
          status: deleted ? "canceled" : status,
          quantity: item?.["quantity"] ?? 1,
          current_period_start: toIso(
            item?.["current_period_start"] ?? object["current_period_start"],
          ),
          current_period_end: toIso(item?.["current_period_end"] ?? object["current_period_end"]),
          cancel_at_period_end: object["cancel_at_period_end"] ?? false,
          environment: env,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_subscription_id" },
      );
      if (subError) return new Response(subError.message, { status: 500 });
    }

    const patch: { plan: string; stripe_customer_id?: string } = { plan: entitlementPlan };
    if (customerId) patch.stripe_customer_id = customerId;

    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", userId);
    if (error) return new Response(error.message, { status: 500 });

    return Response.json({ received: true, plan: entitlementPlan, billed: plan, user_id: userId });
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
    if (error && error.code === "23505") return Response.json({ received: true, duplicate: true });
    if (error) return new Response(error.message, { status: 500 });

    // Soft flags accrue anyway and queue for a human. Shared coworking IPs are
    // normal for this audience and must never auto-reject.
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
    const invoiceId: string | null = object["invoice"] ?? object["charge"]?.["invoice"] ?? null;
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
    if (error && error.code === "23505") return Response.json({ received: true, duplicate: true });
    if (error) return new Response(error.message, { status: 500 });

    return Response.json({ received: true, clawed_back: true });
  }

  return Response.json({ received: true, ignored: event.type });
}
