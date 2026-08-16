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
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { oneOf, integer } from "@/lib/validate";
import {
  priceIdFor,
  TEAMS_SEAT_MAX,
  TEAMS_SEAT_MIN,
  type BillingInterval,
  type PaidPlanId,
} from "@/config/stripe-prices";
import {
  createStripeClient,
  getStripeErrorMessage,
  type StripeEnv,
} from "@/lib/stripe.server";

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
  .inputValidator((d: { plan: string; interval: string; seats?: number; environment: string; returnUrl: string }) => ({
    plan: oneOf(d?.plan, ["starter", "pro", "teams"] as const, "Plan") as PaidPlanId,
    interval: oneOf(d?.interval, ["monthly", "yearly"] as const, "Interval") as BillingInterval,
    // Seats only apply to Teams; clamped so a crafted request cannot bill 10,000 seats.
    seats: d?.seats == null ? TEAMS_SEAT_MIN : integer(d.seats, "Seats", 1, TEAMS_SEAT_MAX),
    environment: envOf(d?.environment),
    returnUrl: String(d?.returnUrl ?? ""),
  }))
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { userId, supabase } = context;
    const { data: auth } = await supabase.auth.getUser();
    const email = auth?.user?.email ?? undefined;

    try {
      const stripe = createStripeClient(data.environment);

      const prices = await stripe.prices.list({
        lookup_keys: [priceIdFor(data.plan, data.interval)],
      });
      const price = prices.data[0];
      if (!price) throw new Error("Price not found — publish the product catalogue first.");

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });
      const isTeams = data.plan === "teams";

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        line_items: [
          {
            price: price.id,
            quantity: isTeams ? Math.max(data.seats, TEAMS_SEAT_MIN) : 1,
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
        subscription_data: { metadata: { user_id: userId, userId, plan: data.plan } },
        metadata: { user_id: userId, userId, plan: data.plan },
        allow_promotion_codes: true,
        // Still collect a VAT ID from business customers: they need it on the
        // invoice for their own records even where no VAT is charged.
        tax_id_collection: { enabled: true },
        billing_address_collection: "required",
        // §312j BGB: the button must say the order obliges payment.
        submit_type: "pay",
        custom_text: {
          submit: {
            message:
              "By completing this order you enter a paid subscription. It renews automatically until cancelled, and you can cancel any time from your account.",
          },
          terms_of_service_acceptance: {
            message:
              "I agree to the terms and privacy policy, and I request that the service begins immediately. I understand that my 14-day right of withdrawal lapses once the service has been fully provided.",
          },
        },
        consent_collection: { terms_of_service: "required" },
      });

      return { clientSecret: session.client_secret ?? "" };
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
