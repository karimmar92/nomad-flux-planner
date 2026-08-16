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

const STRIPE_API = "https://api.stripe.com/v1";

async function assertAdmin(ctx: { supabase: { rpc: Function }; userId: string }) {
  const { data, error } = (await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  })) as { data: unknown; error: unknown };
  if (error || !data) throw new Error("Forbidden");
}

/** Stripe GET. The billing module only had POST, and reads need one too. */
async function stripeGet<T>(path: string): Promise<T> {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Billing is not configured yet.");
  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const json = (await res.json()) as { error?: { message: string } };
  if (!res.ok) throw new Error(json.error?.message ?? "Stripe request failed.");
  return json as T;
}

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
  if (input.foundingNumber != null) return "pro";

  const entitling = ["active", "trialing", "past_due"];
  if (!input.subscriptionStatus || !entitling.includes(input.subscriptionStatus)) return "free";
  return input.planFromPrice ?? "free";
}

type StripeSubList = {
  data: Array<{ status: string; items?: { data?: Array<{ price?: { id?: string } }> } }>;
};

async function stripeStateFor(customerId: string | null) {
  if (!customerId) return { status: null, priceId: null };
  const subs = await stripeGet<StripeSubList>(
    `/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=10`,
  );
  // Prefer an entitling subscription if the customer has several, which happens
  // after an upgrade leaves an old cancelled one behind.
  const entitling = ["active", "trialing", "past_due"];
  const chosen = subs.data.find((s) => entitling.includes(s.status)) ?? subs.data[0] ?? null;
  return {
    status: chosen?.status ?? null,
    priceId: chosen?.items?.data?.[0]?.price?.id ?? null,
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
  .inputValidator((d: { query: string }) => ({
    query: String(d?.query ?? "")
      .trim()
      .slice(0, 200),
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
        const s = await stripeStateFor(customerId);
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
    const client = supabaseAdmin as unknown as {
      from: (t: string) => any;
    };
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
  .inputValidator((d: { userId: string }) => ({ userId: String(d?.userId ?? "").slice(0, 64) }))
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
    const customerId = (p["stripe_customer_id"] as string | null) ?? null;
    const foundingNumber = (p["founding_number"] as number | null) ?? null;

    const { status, priceId } = await stripeStateFor(customerId);
    const expected = expectedPlanFor({
      foundingNumber,
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
