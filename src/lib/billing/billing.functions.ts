/**
 * Checkout and billing management.
 *
 * Uses the Stripe REST API through fetch rather than the SDK — one less
 * dependency, and everything here is two endpoints.
 *
 * GERMAN CONSUMER LAW, built in rather than bolted on later:
 *
 *   * PAngV — the price a consumer sees must be the total payable including
 *     VAT. Handled by marking Stripe prices tax-inclusive and enabling
 *     automatic_tax, so the checkout total is gross at the customer's own rate
 *     (OSS). Do NOT switch prices to tax-exclusive without changing the site.
 *   * §312j BGB (Button-Lösung) — the ordering button must state that the
 *     order carries an obligation to pay. Set via submit_type and custom_text.
 *   * §312k BGB (Kündigungsbutton) — cancelling must be as easy as subscribing
 *     and reachable without logging in to support. The billing portal is that
 *     button; see createPortalSession, linked from the account page.
 *   * Widerrufsrecht — 14-day withdrawal for digital services, which lapses
 *     only with express consent to immediate performance. Collected as a
 *     required consent checkbox at checkout.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { oneOf, integer } from "@/lib/validate";
import { priceIdFor, type BillingInterval, type PaidPlanId } from "@/config/stripe-prices";
import { FOUNDING_PRICE_ENV, foundingIsOpen } from "@/config/founding";

const STRIPE_API = "https://api.stripe.com/v1";

/** Stripe expects application/x-www-form-urlencoded with bracketed nesting. */
function formEncode(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object" && !Array.isArray(v)) {
      out.push(...formEncode(v as Record<string, unknown>, key));
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === "object") {
          out.push(...formEncode(item as Record<string, unknown>, `${key}[${i}]`));
        } else {
          out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return out;
}

async function stripe<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Billing is not configured yet.");
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formEncode(body).join("&"),
  });
  const json = (await res.json()) as { error?: { message: string } };
  if (!res.ok) throw new Error(json.error?.message ?? "Stripe request failed.");
  return json as T;
}

function siteUrl(): string {
  const url = process.env["SITE_URL"] ?? process.env["VITE_SITE_URL"];
  if (!url) throw new Error("SITE_URL is not set — checkout needs absolute return URLs.");
  return url.replace(/\/$/, "");
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan: string; interval: string; seats?: number }) => ({
    plan: oneOf(d?.plan, ["starter", "pro", "teams"] as const, "Plan") as PaidPlanId,
    interval: oneOf(d?.interval, ["monthly", "yearly"] as const, "Interval") as BillingInterval,
    // Seats only apply to Teams; clamped so a crafted request cannot bill 10,000 seats.
    seats: d?.seats == null ? 1 : integer(d.seats, "Seats", 1, 500),
  }))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { data: auth } = await supabase.auth.getUser();
    const email = auth?.user?.email ?? undefined;

    const session = await stripe<{ id: string; url: string }>("/checkout/sessions", {
      mode: "subscription",
      line_items: [
        {
          price: priceIdFor(data.plan, data.interval),
          quantity: data.plan === "teams" ? data.seats : 1,
          /**
           * Per-seat plans: let the buyer set the seat count on Stripe's page,
           * where the total updates as they change it. Sending a fixed
           * quantity from the app meant the amount charged could differ from
           * the price on the card that was clicked — the exact thing PAngV and
           * §312j are about.
           *
           * Bounded to match the server-side clamp on `seats`.
           */
          ...(data.plan === "teams"
            ? { adjustable_quantity: { enabled: true, minimum: 1, maximum: 500 } }
            : {}),
        },
      ],
      /**
       * VAT IS DELIBERATELY OFF — the provider is a §19 UStG Kleinunternehmer.
       *
       * This previously ran `automatic_tax: { enabled: true }`, which makes
       * Stripe compute and add VAT at the customer's rate. The Impressum states
       * the provider is exempt under the small-business regulation and holds no
       * VAT identification number, so collecting VAT would mean charging tax
       * there is no entitlement to collect and no registration to remit it
       * against. That is a worse problem than under-charging.
       *
       * Prices are therefore gross AND final: what the pricing page shows is
       * what is taken, which satisfies PAngV directly rather than via Stripe.
       *
       * ── WHEN THIS MUST CHANGE ──────────────────────────────────────────
       * The exemption is not unconditional. Two thresholds end it:
       *
       *   1. Cross-border B2C digital sales into other EU states above
       *      €10,000/year. Past that, VAT is due at the CUSTOMER's rate and
       *      OSS registration is required — Kleinunternehmer status does not
       *      cover it.
       *   2. Domestic turnover above the §19 limits.
       *
       * This product sells digital subscriptions to consumers across the EU,
       * so threshold 1 is the one that will bite first and it can arrive
       * quickly. Monitor EU-consumer revenue; when it approaches €10,000,
       * register for OSS and set `automatic_tax` back to enabled with
       * tax-exclusive prices.
       *
       * Not tax advice. Confirm with a Steuerberater before launch.
       */
      automatic_tax: { enabled: false },
      // Still collect a VAT ID from business customers: it is needed on the
      // invoice for their own records even where no VAT is charged.
      tax_id_collection: { enabled: true },
      billing_address_collection: "required",
      customer_email: email,
      client_reference_id: userId,
      // The commission webhook reads metadata.user_id off the invoice's
      // subscription. Without this, referral accrual silently stops.
      subscription_data: { metadata: { user_id: userId, plan: data.plan } },
      metadata: { user_id: userId, plan: data.plan },
      allow_promotion_codes: true,
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
      /**
       * /profile, not /account — there IS no /account route. This pointed at
       * one, which meant a customer who had just been charged landed on a 404:
       * the single worst moment in the product to show a broken page, and
       * invisible in testing because it only happens after a real payment.
       *
       * If an /account route is ever added, change both URLs here AND the
       * portal return_url below in the same commit.
       */
      success_url: `${siteUrl()}/profile?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/pricing?checkout=cancelled`,
    });

    return { url: session.url };
  });

/**
 * Founding 100: a ONE-TIME payment that grants Pro permanently.
 *
 * `mode: "payment"`, not `"subscription"`. Getting that wrong charges a
 * founding member $99 every month, and they would be right to be furious.
 * The Stripe price behind FOUNDING_PRICE_ENV must also be created as a
 * one-off price, not a recurring one; Stripe rejects the mismatch, which is
 * the one place this is hard to get wrong silently.
 *
 * The cap is NOT checked here. It is checked in the database when the
 * webhook claims the spot, because two people can pass a check in this
 * function at the same moment and only one spot can exist. What this
 * function does is refuse to open checkout when the cohort is already
 * visibly full, so nobody reaches a payment page for something that is gone.
 */
export const createFoundingCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    const { data: auth } = await supabase.auth.getUser();
    const email = auth?.user?.email ?? undefined;

    const priceId = process.env[FOUNDING_PRICE_ENV];
    if (!priceId) {
      throw new Error(
        `Missing ${FOUNDING_PRICE_ENV}. Create a ONE-TIME price in Stripe (not recurring) and set it in the environment.`,
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Already a founding member: do not let anyone buy the same thing twice.
    const { data: mine } = await supabaseAdmin
      .from("profiles")
      .select("founding_number")
      .eq("id", userId)
      .maybeSingle();
    if ((mine as { founding_number?: number | null } | null)?.founding_number != null) {
      throw new Error("You already have a founding spot.");
    }

    const { fetchFoundingTaken } = await import("@/lib/founding/rpc");
    const taken = (await fetchFoundingTaken(supabaseAdmin)) ?? 0;
    if (!foundingIsOpen(taken)) {
      throw new Error("All 100 founding spots have been taken.");
    }

    const session = await stripe<{ id: string; url: string }>("/checkout/sessions", {
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      // Same §19 UStG position as the subscriptions. See the long note above.
      automatic_tax: { enabled: false },
      tax_id_collection: { enabled: true },
      billing_address_collection: "required",
      customer_email: email,
      client_reference_id: userId,
      /**
       * `founding: "1"` is what the webhook keys on. Without it the handler
       * cannot tell a lifetime purchase from any other one-off payment, and
       * the buyer pays and receives nothing.
       */
      metadata: { user_id: userId, founding: "1" },
      payment_intent_data: { metadata: { user_id: userId, founding: "1" } },
      // §312j BGB: the button must say the order obliges payment.
      submit_type: "pay",
      custom_text: {
        submit: {
          message:
            "One payment. No subscription, nothing to cancel, and no renewal. This grants Pro access for as long as Driftly exists.",
        },
        terms_of_service_acceptance: {
          message:
            "I agree to the terms and privacy policy, and I request that access begins immediately. I understand that my 14-day right of withdrawal lapses once the service has been fully provided.",
        },
      },
      consent_collection: { terms_of_service: "required" },
      success_url: `${siteUrl()}/profile?checkout=founding&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/pricing?checkout=cancelled`,
    });

    return { url: session.url };
  });

/**
 * Billing portal — this IS the Kündigungsbutton under §312k BGB. Cancelling
 * must be no harder than subscribing, so the account page links straight here
 * rather than asking anyone to email support.
 */
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    const customer = (profile as { stripe_customer_id?: string } | null)?.stripe_customer_id;
    if (!customer) throw new Error("No subscription found for this account.");

    const session = await stripe<{ url: string }>("/billing_portal/sessions", {
      customer,
      return_url: `${siteUrl()}/profile`,
    });
    return { url: session.url };
  });
