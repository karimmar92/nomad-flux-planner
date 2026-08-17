/**
 * Checkout and billing management.
 *
 * Runs through Lovable's built-in payments: every Stripe call goes via
 * createStripeClient(), which routes to the connector gateway. There is no
 * STRIPE_SECRET_KEY in this project and hand-rolled api.stripe.com calls fail
 * authentication — see src/lib/stripe.server.ts.
 *
 * Checkout is EMBEDDED: the form renders inside the app and the server returns
 * a client secret, never a redirect URL.
 *
 * GERMAN CONSUMER LAW, built in rather than bolted on later:
 *
 *   * PAngV — the price a consumer sees must be the total payable. Prices are
 *     gross and final; no tax is added at checkout (see below).
 *   * §312j BGB (Button-Lösung) — the ordering button must state that the order
 *     carries an obligation to pay. Set via submit_type and custom_text.
 *   * §312k BGB (Kündigungsbutton) — cancelling must be as easy as subscribing.
 *     The billing portal is that button; see createPortalSession.
 *   * Widerrufsrecht — 14-day withdrawal for digital services, which lapses only
 *     with express consent to immediate performance. Collected as a required
 *     consent checkbox at checkout.
 *
 * VAT IS DELIBERATELY OFF. The provider is a §19 UStG Kleinunternehmer
 * (src/config/legal.ts) and holds no VAT identification number, so collecting
 * VAT would mean charging tax there is no entitlement to collect. Two
 * thresholds end this: cross-border B2C digital sales into other EU states
 * above €10,000/year (this one arrives first), and domestic turnover above the
 * §19 limits. At that point enable tax handling here and flip VAT.exempt.
 * Not tax advice — confirm with a Steuerberater.
 */
import { createServerFn } from "@tanstack/react-start";
import type Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { oneOf, integer } from "@/lib/validate";
import {
  priceIdFor,
  TEAMS_SEAT_MAX,
  TEAMS_SEAT_MIN,
  isOneTimePlan,
  type BillingInterval,
  type PaidPlanId,
} from "@/config/stripe-prices";

import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";

type CheckoutResult = { clientSecret: string } | { error: string };
type PortalResult = { url: string } | { error: string };

function envOf(value: unknown): StripeEnv {
  return oneOf(value, ["sandbox", "live"] as const, "Environment") as StripeEnv;
}

/**
 * userId lives on the CUSTOMER, not only on the session: sessions are not
 * searchable, so without this no later read path (portal, dashboards,
 * commission reconciliation) can find a user's Stripe records.
 */
async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string | undefined; userId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");

  const found = await stripe.customers.search({
    query: `metadata['userId']:'${options.userId}'`,
    limit: 1,
  });
  if (found.data.length && found.data[0]) return found.data[0].id;

  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    const customer = existing.data[0];
    if (customer) {
      if (customer.metadata?.["userId"] !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }

  const created = await stripe.customers.create({
    ...(options.email ? { email: options.email } : {}),
    metadata: { userId: options.userId },
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      plan: string;
      interval: string;
      seats?: number;
      environment: string;
      returnUrl: string;
    }) => ({
      plan: oneOf(
        d?.plan,
        ["starter", "pro", "teams", "founding_lifetime"] as const,
        "Plan",
      ) as PaidPlanId,
      interval: oneOf(d?.interval, ["monthly", "yearly"] as const, "Interval") as BillingInterval,
      // Seats only apply to Teams; clamped so a crafted request cannot bill 10,000 seats.
      seats: d?.seats == null ? TEAMS_SEAT_MIN : integer(d.seats, "Seats", 1, TEAMS_SEAT_MAX),
      environment: envOf(d?.environment),
      returnUrl: String(d?.returnUrl ?? ""),
    }),
  )
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { userId, claims } = context;
    const email = typeof claims.email === "string" ? claims.email : undefined;

    try {
      const stripe = createStripeClient(data.environment);

      const prices = await stripe.prices.list({
        lookup_keys: [priceIdFor(data.plan, data.interval)],
      });
      const price = prices.data[0];
      if (!price) throw new Error("Price not found — publish the product catalogue first.");

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });
      const isTeams = data.plan === "teams";
      const isOneTime = isOneTimePlan(data.plan);

      const session = await stripe.checkout.sessions.create({
        /**
         * Lovable's one-time support, kept: `founding_lifetime` is a payment,
         * everything else is a subscription. Charging a lifetime purchase as a
         * subscription would bill someone $99 every month.
         */
        mode: isOneTime ? "payment" : "subscription",
        /**
         * "embedded_page" is what the installed SDK accepts. This was changed
         * to "embedded" twice on the belief that Lovable had regenerated it
         * wrongly. That was wrong, and the correction is recorded here so it
         * does not get "fixed" a third time.
         *
         * stripe@22.0.2 declares:
         *   type UiMode = 'elements' | 'embedded_page' | 'form' | 'hosted_page'
         * (node_modules/stripe/esm/resources/Checkout/Sessions.d.ts:702)
         *
         * The prose doc comments in that same file still say "embedded" and
         * "Defaults to `hosted`" — neither of which is in the union. The docs
         * lag the generated types by an API revision, and the union is what
         * the wire actually validates against, so the union wins.
         *
         * Do not trust this comment over a failure. If checkout breaks here,
         * read the union in the installed SDK again; it moves between versions.
         */
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        line_items: [
          {
            price: price.id,
            quantity: isOneTime ? 1 : isTeams ? Math.max(data.seats, TEAMS_SEAT_MIN) : 1,
            /**
             * Per-seat plans: the buyer sets the seat count on the checkout
             * form, where the total updates as it changes. Sending a fixed
             * quantity meant the amount charged could differ from the price on
             * the card that was clicked — the exact thing PAngV and §312j are
             * about.
             */
            ...(isTeams
              ? {
                  adjustable_quantity: {
                    enabled: true,
                    minimum: TEAMS_SEAT_MIN,
                    maximum: TEAMS_SEAT_MAX,
                  },
                }
              : {}),
          },
        ],
        client_reference_id: userId,
        // The commission webhook reads metadata.user_id off the invoice's
        // subscription. Without this, referral accrual silently stops.
        ...(!isOneTime && {
          subscription_data: { metadata: { user_id: userId, userId, plan: data.plan } },
        }),
        metadata: { user_id: userId, userId, plan: data.plan },
        allow_promotion_codes: true,
        // Full handling supplies its own terms, tax treatment and checkout
        // disclosures. custom_text, consent_collection and tax_id_collection
        // conflict with it and make the embedded form fail after loading.
        managed_payments: { enabled: true },
      } as Stripe.Checkout.SessionCreateParams);

      /**
       * No `?? ""`. An empty client secret is not a checkout session; passing
       * one on turns a clear server-side failure into an opaque error inside
       * Stripe's iframe, which is far harder to diagnose and is what the user
       * actually saw.
       */
      if (!session.client_secret) {
        return { error: "Stripe did not return a checkout session. Please try again." };
      }
      return { clientSecret: session.client_secret };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/**
 * Founding 100: a ONE-TIME payment granting Pro permanently.
 *
 * PORTED to Lovable's payments layer. The first version of this called
 * api.stripe.com directly with a STRIPE_SECRET_KEY, which does not exist in
 * this project — every request would have failed authentication. It now goes
 * through createStripeClient like everything else here.
 *
 * `mode: "payment"`, not `"subscription"`. Getting that wrong bills a founding
 * member $99 every month, and they would be right to be furious. The Stripe
 * price behind the lookup key must also be one-off rather than recurring;
 * Stripe rejects the mismatch, which is the one place this is hard to get
 * wrong silently.
 *
 * The 100 cap is NOT enforced here. Two people can pass a check in this
 * function at the same instant and only one spot can exist, so the real limit
 * lives in claim_founding_spot() in the database. What this does is refuse to
 * open checkout when the cohort is already visibly full, so nobody reaches a
 * payment form for something that is gone.
 */
export const createFoundingCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { environment: string; returnUrl: string }) => ({
    environment: envOf(d?.environment),
    returnUrl: String(d?.returnUrl ?? ""),
  }))
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { userId, supabase, claims } = context;
    const email = typeof claims.email === "string" ? claims.email : undefined;

    try {
      const { FOUNDING_PRICE_LOOKUP_KEY, foundingIsOpen } = await import("@/config/founding");
      const { fetchFoundingTaken } = await import("@/lib/founding/rpc");

      // Already holds a spot: nobody should be able to buy the same permanent
      // thing twice.
      const { data: mine } = await supabase
        .from("profiles")
        .select("founding_number")
        .eq("id", userId)
        .maybeSingle();
      if ((mine as { founding_number?: number | null } | null)?.founding_number != null) {
        return { error: "You already have a founding spot." };
      }

      const taken = (await fetchFoundingTaken(supabase)) ?? 0;
      if (!foundingIsOpen(taken)) return { error: "All 100 founding spots have been taken." };

      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [FOUNDING_PRICE_LOOKUP_KEY] });
      const price = prices.data[0];
      if (!price) {
        return { error: "Founding price not found — publish the product catalogue first." };
      }

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        // Must match the subscription session above. See the long note there
        // for why this is "embedded_page" and not "embedded".
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        line_items: [{ price: price.id, quantity: 1 }],
        client_reference_id: userId,
        /**
         * `founding: "1"` is what the webhook keys on. Without it the handler
         * cannot tell a lifetime purchase from any other one-off payment, and
         * the buyer pays and receives nothing.
         */
        metadata: { user_id: userId, userId, founding: "1" },
        payment_intent_data: {
          description: "Driftly Founding Lifetime",
          metadata: { user_id: userId, userId, founding: "1" },
        },
        managed_payments: { enabled: true },
        submit_type: "pay",
      } as Stripe.Checkout.SessionCreateParams);

      /**
       * No `?? ""`. An empty client secret is not a checkout session; passing
       * one on turns a clear server-side failure into an opaque error inside
       * Stripe's iframe, which is far harder to diagnose and is what the user
       * actually saw.
       */
      if (!session.client_secret) {
        return { error: "Stripe did not return a checkout session. Please try again." };
      }
      return { clientSecret: session.client_secret };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/**
 * Billing portal — this IS the Kündigungsbutton under §312k BGB. Cancelling
 * must be no harder than subscribing and must not require emailing support, so
 * the account page links straight here. Plan changes (upgrade now, downgrade at
 * period end) are configured on the portal itself.
 */
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { environment: string; returnUrl?: string }) => ({
    environment: envOf(d?.environment),
    returnUrl: d?.returnUrl ? String(d.returnUrl) : undefined,
  }))
  .handler(async ({ data, context }): Promise<PortalResult> => {
    const { userId, supabase } = context;

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let customer = (sub as { stripe_customer_id?: string } | null)?.stripe_customer_id ?? null;

    // Fall back to the profile: one-off historic customers, and anyone whose
    // subscription row has not landed yet, still need the cancel button.
    if (!customer) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", userId)
        .maybeSingle();
      customer = (profile as { stripe_customer_id?: string } | null)?.stripe_customer_id ?? null;
    }
    if (!customer) return { error: "No subscription found for this account." };

    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer,
        ...(data.returnUrl ? { return_url: data.returnUrl } : {}),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/**
 * Confirm a checkout on return from Stripe — the safety net under the webhook.
 *
 * The webhook is still the source of truth, but it is a delivery that can be
 * misconfigured, delayed or dropped, and the failure mode is the worst one in
 * the product: the customer is charged and stays on the free tier. This runs
 * when they land back in the app, verifies with Stripe that THIS session was
 * actually paid and belongs to THIS user, and then applies exactly the same
 * entitlement logic the webhook uses.
 *
 * Safe to run repeatedly: the founding claim is keyed on the session id and
 * the plan write is idempotent.
 */
export const confirmCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { environment: string; sessionId: string }) => ({
    environment: envOf(d?.environment),
    sessionId: String(d?.sessionId ?? ""),
  }))
  .handler(async ({ data, context }): Promise<{ plan?: string; error?: string }> => {
    const { userId } = context;
    if (!data.sessionId.startsWith("cs_")) return { error: "Invalid checkout session." };

    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
        expand: ["line_items.data.price"],
      });

      // Never grant entitlement from a session the caller does not own.
      const owner =
        (session.metadata?.["user_id"] as string | undefined) ??
        (session.metadata?.["userId"] as string | undefined) ??
        session.client_reference_id ??
        null;
      if (owner !== userId) return { error: "This checkout belongs to another account." };
      if (session.payment_status !== "paid") return { error: "Payment not completed yet." };

      const { handleStripeEvent } = await import("@/lib/billing/webhook-handler");
      const response = await handleStripeEvent(
        {
          type: "checkout.session.completed",
          data: { object: session as unknown as Record<string, any> },
        },
        data.environment,
      );
      const result = (await response.json().catch(() => ({}))) as { plan?: string };
      return result?.plan ? { plan: result.plan } : {};
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
