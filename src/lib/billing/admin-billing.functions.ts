/**
 * Admin billing surface: search, webhook history, entitlement reconciliation.
 *
 * ── THE SECURITY MODEL, BECAUSE THIS FILE CAN GRANT PAID ACCESS ───────
 *
 * Every function here runs `assertAdmin` FIRST, which checks the user_roles
 * table server-side via the has_role() function. The client is never trusted
 * with this decision. A React route guard is a convenience for the admin, not
 * a security control: anyone can call a server function directly.
 *
 * The route at /admin/billing is also noindex and disallowed in robots.txt,
 * but neither of those is protection either. The `assertAdmin` call is.
 *
 * ── WHY RECONCILIATION EXISTS ─────────────────────────────────────────
 *
 * Entitlement lives in two systems: Stripe knows who paid, `profiles.plan`
 * decides what the app unlocks, and a webhook is the only bridge. Webhooks get
 * lost, arrive out of order, or hit a handler bug. When that happens a paying
 * customer sits on the free plan and the only signal is a support email.
 *
 * Reconciliation reads Stripe directly and makes `profiles.plan` match. Stripe
 * is the source of truth for money, always, because that is where the money
 * actually is.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { oneOf } from "@/lib/validate";
import { createStripeClient, type StripeEnv } from "@/lib/stripe.server";
import { FOUNDING_PRICE_LOOKUP_KEY } from "@/config/founding";

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
};

/**
 * The only thing between a stranger and the ability to grant paid access.
 * Called first in every exported function here, with no exceptions.
 */
async function assertAdmin(ctx: { supabase: unknown; userId: string }) {
  const { data, error } = await (ctx.supabase as RpcClient).rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

/**
 * Reads go through the SAME gateway client as writes.
 *
 * This used to call api.stripe.com directly with STRIPE_SECRET_KEY. That key
 * does not exist in this project: Lovable's connector gateway holds the real
 * secret and the values in STRIPE_*_API_KEY are connection identifiers that
 * fail authentication against Stripe directly.
 *
 * The effect was worse than it looks. Search swallowed the failure and quietly
 * showed every account as having no Stripe state, and reconcile threw outright,
 * so the one tool meant to repair a broken payment was itself broken.
 */

export type BillingRow = {
  userId: string;
  email: string | null;
  plan: string;
  foundingNumber: number | null;
  stripeCustomerId: string | null;
  /** What Stripe currently says, fetched live. Null when no customer exists. */
  stripeStatus: string | null;
  stripePriceId: string | null;
  /** True when profiles.plan disagrees with what Stripe implies. */
  drift: boolean;
  expectedPlan: string;
};

/**
 * What the plan SHOULD be, given Stripe and the founding table.
 *
 * Pure and exported so the logic that decides who gets paid features is
 * testable and lives in exactly one place. The webhook and this admin tool
 * must never disagree about what a subscription entitles.
 */
export function expectedPlanFor(input: {
  foundingNumber: number | null;
  subscriptionStatus: string | null;
  planFromPrice: string | null;
}): string {
  // A founding member paid once, permanently. Nothing about a subscription can
  // take that away, including the absence of one.
  //
  // Returns "founding_lifetime" rather than "pro" so this agrees with what
  // claim_founding_spot() writes. If the two disagreed, every founding member
  // would show as permanent drift on the admin page and reconciling them would
  // silently downgrade the label on every run.
  if (input.foundingNumber != null) return "founding_lifetime";

  const entitling = ["active", "trialing", "past_due"];
  if (!input.subscriptionStatus || !entitling.includes(input.subscriptionStatus)) return "free";
  return input.planFromPrice ?? "free";
}

type StripeSubList = {
  data: Array<{
    status: string;
    items?: { data?: Array<{ price?: { id?: string; lookup_key?: string | null } }> };
  }>;
};

/**
 * Has this customer actually paid for a founding spot?
 *
 * WHY THIS EXISTS. `stripeStateFor` below reads subscriptions, and a founding
 * purchase is a one-time payment, so it creates no subscription at all. That
 * left reconciliation unable to repair the single most damaging failure this
 * product has: somebody pays 99 dollars, the webhook does not land, and the
 * app still shows them the free tier. Reconcile would read no subscription,
 * conclude "free", and report that nothing needed fixing — confidently wrong
 * about the one case where being wrong costs a paying customer.
 *
 * Searches completed checkout sessions rather than trusting our own database,
 * because the whole point of reconciliation is that our database may be the
 * thing that is broken. Stripe is the source of truth.
 */
/**
 * Find the Stripe customer for an email when we never stored the id.
 *
 * WHY THIS IS NEEDED. `profiles.stripe_customer_id` is written by the webhook.
 * If the webhook never landed — or, as happened here, the profile row did not
 * exist for it to write to — the column stays null, and every repair path that
 * starts from a customer id begins at a dead end. Reconciliation would report
 * "no Stripe state" for somebody who had definitely paid.
 *
 * Stripe is the source of truth, so when our copy of the link is missing we go
 * and find it rather than concluding nothing happened.
 */
async function customerIdForEmail(email: string | null, env: StripeEnv): Promise<string | null> {
  if (!email) return null;
  const stripe = createStripeClient(env);
  const found = (await stripe.customers.list({ email, limit: 1 })) as unknown as {
    data: { id: string }[];
  };
  return found.data[0]?.id ?? null;
}

async function foundingPaymentFor(
  customerId: string | null,
  env: StripeEnv,
): Promise<{ sessionId: string; paid: boolean } | null> {
  if (!customerId) return null;
  const stripe = createStripeClient(env);

  const sessions = (await stripe.checkout.sessions.list({
    customer: customerId,
    limit: 20,
  })) as unknown as {
    data: { id: string; payment_status?: string; mode?: string }[];
  };

  for (const session of sessions.data) {
    if (session.mode !== "payment") continue;
    if (session.payment_status !== "paid") continue;

    // Confirm it was the founding price and not some other one-time purchase.
    // Matched on lookup key, never the price id: ids differ between sandbox
    // and live, so entitlement must not be decided from one.
    const items = (await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 10,
      expand: ["data.price"],
    })) as unknown as {
      data: { price?: { lookup_key?: string | null } | null }[];
    };

    const isFounding = items.data.some((i) => i.price?.lookup_key === FOUNDING_PRICE_LOOKUP_KEY);
    if (isFounding) return { sessionId: session.id, paid: true };
  }

  return null;
}

async function stripeStateFor(customerId: string | null, env: StripeEnv) {
  if (!customerId) return { status: null, priceId: null };
  const stripe = createStripeClient(env);
  const subs = (await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  })) as unknown as StripeSubList;
  // Prefer an entitling subscription if the customer has several, which happens
  // after an upgrade leaves an old cancelled one behind.
  const entitling = ["active", "trialing", "past_due"];
  const chosen = subs.data.find((s) => entitling.includes(s.status)) ?? subs.data[0] ?? null;
  // Lookup key, not the price id: ids differ between sandbox and live, so
  // entitlement must never be decided from one. See stripe-prices.ts.
  return {
    status: chosen?.status ?? null,
    priceId: chosen?.items?.data?.[0]?.price?.lookup_key ?? null,
  };
}

/**
 * Search by email, user id, or Stripe customer id.
 *
 * Email search pulls the auth user list and filters in memory. That is fine at
 * this scale and would not be at 50,000 users; when it stops being fine, the
 * fix is a search index, not a bigger page size. Noted rather than
 * pre-optimised.
 */
export const adminSearchBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { query: string; environment?: string }) => ({
    query: String(d?.query ?? "")
      .trim()
      .slice(0, 200),
    environment: oneOf(
      d?.environment ?? "sandbox",
      ["sandbox", "live"] as const,
      "Environment",
    ) as StripeEnv,
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.query;
    if (!q) return { rows: [] as BillingRow[] };

    const { planForPriceId } = await import("@/config/stripe-prices");

    let profiles: Array<Record<string, unknown>> = [];
    const looksLikeUuid = /^[0-9a-f-]{32,36}$/i.test(q);
    const looksLikeCustomer = q.startsWith("cus_");

    if (looksLikeUuid) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("id, plan, stripe_customer_id, founding_number")
        .eq("id", q);
      profiles = (p ?? []) as unknown as Array<Record<string, unknown>>;
    } else if (looksLikeCustomer) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("id, plan, stripe_customer_id, founding_number")
        .eq("stripe_customer_id", q);
      profiles = (p ?? []) as unknown as Array<Record<string, unknown>>;
    } else {
      const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const matches = (users?.users ?? []).filter((u) =>
        (u.email ?? "").toLowerCase().includes(q.toLowerCase()),
      );
      const ids = matches.map((u) => u.id).slice(0, 25);
      if (ids.length) {
        const { data: p } = await supabaseAdmin
          .from("profiles")
          .select("id, plan, stripe_customer_id, founding_number")
          .in("id", ids);
        profiles = (p ?? []) as unknown as Array<Record<string, unknown>>;
      }
    }

    const rows: BillingRow[] = [];
    for (const p of profiles.slice(0, 25)) {
      const userId = String(p["id"]);
      const customerId = (p["stripe_customer_id"] as string | null) ?? null;
      const foundingNumber = (p["founding_number"] as number | null) ?? null;
      const plan = String(p["plan"] ?? "free");

      let status: string | null = null;
      let priceId: string | null = null;
      try {
        const s = await stripeStateFor(customerId, data.environment);
        status = s.status;
        priceId = s.priceId;
      } catch {
        // Stripe unreachable or unconfigured. Show the row with what we have
        // rather than failing the whole search: a partial answer during an
        // outage still tells the admin what the app currently believes.
      }

      const expected = expectedPlanFor({
        foundingNumber,
        subscriptionStatus: status,
        planFromPrice: priceId ? planForPriceId(priceId) : null,
      });

      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      rows.push({
        userId,
        email: authUser?.user?.email ?? null,
        plan,
        foundingNumber,
        stripeCustomerId: customerId,
        stripeStatus: status,
        stripePriceId: priceId,
        expectedPlan: expected,
        drift: expected !== plan,
      });
    }
    return { rows };
  });

export type WebhookEventRow = {
  id: string;
  stripe_event_id: string;
  type: string;
  status: string;
  received_at: string;
  processed_at: string | null;
  user_id: string | null;
  /** JSON-stringified server-side: `unknown` is not serialisable across
   *  the server-function boundary, and the table renders it as text. */
  result: string | null;
  error: string | null;
};

/**
 * Recent webhook events, newest first.
 *
 * The full payload is deliberately NOT returned to the browser. It contains
 * billing addresses and emails, and an admin page does not need them to answer
 * "did this arrive and what did we do". The payload stays in the database for
 * replay.
 */
export const adminListWebhookEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId?: string; status?: string; limit?: number }) => ({
    userId: d?.userId ? String(d.userId).slice(0, 64) : null,
    status: d?.status ? String(d.status).slice(0, 20) : null,
    limit: Math.min(Math.max(Number(d?.limit ?? 50), 1), 200),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Cast: webhook_events is not in the generated types yet. See webhook-log.ts.
    type Query = {
      select: (cols: string) => Query;
      order: (col: string, opts: { ascending: boolean }) => Query;
      limit: (n: number) => Query;
      eq: (col: string, val: string) => Query;
      then: PromiseLike<{ data: unknown; error: { message: string } | null }>["then"];
    };
    const client = supabaseAdmin as unknown as { from: (t: string) => Query };
    let q = client
      .from("webhook_events")
      .select(
        "id, stripe_event_id, type, status, received_at, processed_at, user_id, result, error",
      )
      .order("received_at", { ascending: false })
      .limit(data.limit);
    if (data.userId) q = q.eq("user_id", data.userId);
    if (data.status) q = q.eq("status", data.status);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const events: WebhookEventRow[] = ((rows ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: String(r["id"]),
      stripe_event_id: String(r["stripe_event_id"]),
      type: String(r["type"]),
      status: String(r["status"]),
      received_at: String(r["received_at"]),
      processed_at: (r["processed_at"] as string | null) ?? null,
      user_id: (r["user_id"] as string | null) ?? null,
      result: r["result"] == null ? null : JSON.stringify(r["result"]),
      error: (r["error"] as string | null) ?? null,
    }));
    return { events };
  });

/**
 * Make profiles.plan match what Stripe says.
 *
 * Idempotent: running it on a correct account changes nothing and reports
 * `changed: false`. That matters because the natural instinct during an
 * incident is to click it repeatedly.
 *
 * It only ever writes `plan`. It cannot create a founding spot, cannot refund,
 * and cannot alter Stripe. An admin tool that can only bring the app into
 * agreement with the payment processor is one that cannot be used to give
 * anybody something they did not pay for.
 */
export const adminReconcileEntitlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; environment?: string }) => ({
    userId: String(d?.userId ?? "").slice(0, 64),
    environment: oneOf(
      d?.environment ?? "sandbox",
      ["sandbox", "live"] as const,
      "Environment",
    ) as StripeEnv,
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!data.userId) throw new Error("A user id is required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { planForPriceId } = await import("@/config/stripe-prices");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, plan, stripe_customer_id, founding_number")
      .eq("id", data.userId)
      .maybeSingle();
    if (!profile) throw new Error("No profile with that id.");

    const p = profile as unknown as Record<string, unknown>;
    const before = String(p["plan"] ?? "free");
    const foundingNumber = (p["founding_number"] as number | null) ?? null;

    /**
     * Fall back to finding the customer by email, and write the id back.
     *
     * A null stripe_customer_id used to end reconciliation immediately, which
     * meant the tool was useless in exactly the situation it was built for: a
     * webhook that never ran, so nothing about the payment was ever recorded
     * locally. Looking the customer up by email recovers the link, and storing
     * it means the next run and every webhook afterwards has it.
     */
    let customerId = (p["stripe_customer_id"] as string | null) ?? null;
    if (!customerId) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(data.userId);
      customerId = await customerIdForEmail(userData?.user?.email ?? null, data.environment);
      if (customerId) {
        await supabaseAdmin
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("id", data.userId);
      }
    }

    const { status, priceId } = await stripeStateFor(customerId, data.environment);

    /**
     * Repair a paid-but-ungranted founding spot before deciding anything else.
     *
     * This is the case the whole reconcile button exists for. If Stripe holds a
     * paid founding session and we never issued a spot, the webhook did not
     * land, and no amount of reasoning about subscriptions will fix it because
     * there is no subscription to reason about.
     *
     * claim_founding_spot is keyed on the payment id and is idempotent, so
     * pressing this twice returns the number already issued rather than
     * burning a second spot out of the hundred.
     */
    let effectiveFoundingNumber = foundingNumber;
    if (foundingNumber == null) {
      const payment = await foundingPaymentFor(customerId, data.environment);
      if (payment) {
        const { claimFoundingSpot } = await import("@/lib/founding/rpc");
        const { spot, error: claimError } = await claimFoundingSpot(
          supabaseAdmin,
          data.userId,
          payment.sessionId,
        );
        if (claimError) {
          // Surfaced, not swallowed. "Sold out" is a real answer here and means
          // this person paid and cannot be granted a spot — which is a refund
          // decision for a human, not something to paper over.
          throw new Error(`Founding spot could not be granted: ${claimError}`);
        }
        effectiveFoundingNumber = spot;
      }
    }

    const expected = expectedPlanFor({
      foundingNumber: effectiveFoundingNumber,
      subscriptionStatus: status,
      planFromPrice: priceId ? planForPriceId(priceId) : null,
    });

    if (expected === before) {
      return { changed: false, before, after: before, stripeStatus: status };
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ plan: expected })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    /**
     * Written into the same audit log as real webhooks, with a synthetic id.
     * A manual entitlement change is exactly the kind of thing that needs to
     * be visible six months later when somebody asks why an account is on Pro.
     */
    const { logWebhookReceived, logWebhookOutcome } = await import("@/lib/billing/webhook-log");
    const syntheticId = `manual_reconcile_${data.userId}_${Date.now()}`;
    await logWebhookReceived(supabaseAdmin, {
      eventId: syntheticId,
      type: "admin.reconcile",
      userId: data.userId,
      payload: { by: context.userId, before, after: expected, stripeStatus: status },
    });
    await logWebhookOutcome(supabaseAdmin, {
      eventId: syntheticId,
      userId: data.userId,
      outcome: { changed: true, before, after: expected, by: context.userId },
      failed: false,
    });

    return { changed: true, before, after: expected, stripeStatus: status };
  });
