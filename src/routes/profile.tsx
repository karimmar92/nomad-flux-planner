import { createFileRoute, Link } from "@tanstack/react-router";
import { CITIES } from "@/lib/cities";
import { useProfile, useSavedCities } from "@/lib/store";
import { flagEmoji } from "@/lib/arbitrage";
import { APP_NAME } from "@/lib/app";
import type { IncomeType } from "@/lib/types";
import { EmptyState } from "@/components/Primitives";
import { UserReferralCard } from "@/components/referrals/UserReferralCard";
import { HeardAboutField } from "@/components/referrals/HeardAboutField";
import { useSession } from "@/lib/use-session";
import { DeleteAccount } from "@/components/account/DeleteAccount";
import { BillingCard } from "@/components/billing/BillingCard";
import { CheckoutReturn } from "@/components/billing/CheckoutReturn";

export const Route = createFileRoute("/profile")({
  /**
   * The checkout return lands here as ?checkout=…&session_id=…
   *
   * Both were previously ignored, so a buyer came back from paying to a page
   * that said nothing and a product that still behaved as if they had not. The
   * session id is the only thing needed; it is verified against Stripe
   * server-side and grants nothing on its own.
   */
  validateSearch: (s: Record<string, unknown>): { checkout?: string; session_id?: string } => {
    /**
     * Keys are OMITTED when absent, not set to undefined.
     *
     * Under exactOptionalPropertyTypes, returning `{ session_id: undefined }`
     * makes the property required-and-possibly-undefined, which forced every
     * one of the twelve `<Link to="/profile">` call sites in the app to pass a
     * `search` prop. Building the object conditionally keeps them optional.
     */
    const out: { checkout?: string; session_id?: string } = {};
    if (typeof s["checkout"] === "string") out.checkout = s["checkout"];
    if (typeof s["session_id"] === "string") out.session_id = s["session_id"];
    return out;
  },
  head: () => ({
    meta: [
      { title: `Your profile | ${APP_NAME}` },
      {
        name: "description",
        content: "Set your passport, income and home city — every figure is derived from these.",
      },
      { property: "og:title", content: `Your profile | ${APP_NAME}` },
      {
        property: "og:description",
        content: "Set your passport, income and home city to personalise every number.",
      },
    ],
  }),
  component: ProfilePage,
});

const NATIONALITIES = ["GB", "US", "CA", "AU", "DE", "FR", "NL", "IE", "ZA", "IN", "BR"];

function ProfilePage() {
  const { profile, patchProfile } = useProfile();
  const { saved, toggle } = useSavedCities();
  const { signedIn } = useSession();
  const { session_id: sessionId } = Route.useSearch();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Your profile</h1>

      {/* First thing on the page after paying, above everything else. The
          buyer's only question at this moment is "did that work". */}
      {sessionId ? <CheckoutReturn sessionId={sessionId} /> : null}

      <section className="panel grid gap-4 p-4 sm:grid-cols-2">
        <Field label="Display name">
          <input
            value={profile.display_name}
            onChange={(e) => patchProfile({ display_name: e.target.value })}
            placeholder="Optional"
            className="input"
          />
        </Field>

        <Field label="Passport nationality">
          <select
            value={profile.nationality}
            onChange={(e) => patchProfile({ nationality: e.target.value })}
            className="input"
          >
            {NATIONALITIES.map((n) => (
              <option key={n} value={n}>
                {flagEmoji(n)} {n}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Monthly income (USD)">
          <input
            inputMode="numeric"
            value={profile.monthly_income_usd ?? ""}
            onChange={(e) =>
              patchProfile({
                monthly_income_usd: e.target.value
                  ? Number(e.target.value.replace(/\D/g, ""))
                  : null,
              })
            }
            placeholder="5000"
            className="input num"
          />
        </Field>

        <Field label="Income type">
          <select
            value={profile.income_type}
            onChange={(e) => patchProfile({ income_type: e.target.value as IncomeType })}
            className="input"
          >
            <option value="employed">Employed</option>
            <option value="freelance">Freelance</option>
            <option value="founder">Founder</option>
          </select>
        </Field>

        <Field label="Home city">
          <select
            value={profile.home_city_id ?? ""}
            onChange={(e) => patchProfile({ home_city_id: e.target.value || null })}
            className="input"
          >
            <option value="">Not set</option>
            {CITIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.city}, {c.country}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Current savings (USD)">
          <input
            inputMode="numeric"
            value={profile.savings_usd ?? ""}
            onChange={(e) =>
              patchProfile({
                savings_usd: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null,
              })
            }
            placeholder="Optional — powers runway"
            className="input num"
          />
        </Field>
      </section>

      {/* Program B — free months only. The cash creator programme lives at /creator. */}
      <UserReferralCard signedIn={signedIn} />

      <HeardAboutField signedIn={signedIn} />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Saved cities</h2>
        {saved.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            body="Bookmark cities from Explore and they'll collect here for quick comparison."
            action={
              <Link
                to="/"
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              >
                Browse cities
              </Link>
            }
          />
        ) : (
          <div className="panel divide-y divide-border">
            {saved.map((id) => {
              const city = CITIES.find((c) => c.id === id);
              if (!city) return null;
              return (
                <div key={id} className="flex items-center justify-between px-4 py-2.5">
                  <Link to="/city/$cityId" params={{ cityId: id }} className="text-sm">
                    {flagEmoji(city.country_code)} {city.city}, {city.country}
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className="text-xs text-muted-foreground hover:text-negative"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        <Link to="/kit" className="text-primary underline-offset-2 hover:underline">
          Nomad kit — eSIM &amp; insurance
        </Link>{" "}
        ·{" "}
        <Link to="/how-we-make-money" className="hover:text-foreground">
          How we make money
        </Link>{" "}
        ·{" "}
        <Link to="/creators" className="hover:text-foreground">
          Creator programme
        </Link>
      </p>

      {/*
        Billing, including the § 312k cancellation button. Replaces a one-line
        "Plan: free · See Pro" that showed the plan but gave a paying customer
        no way to change or end it.
      */}
      <BillingCard />

      {/*
        GDPR Art.17 and App Store 5.1.1(v) both require in-app account
        deletion. Last on the page, but on the page — not hidden behind a
        support email, which is the pattern Apple rejects.
      */}
      <DeleteAccount />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-xs">{label}</span>
      <div className="mt-1 [&_.input]:w-full [&_.input]:rounded-md [&_.input]:border [&_.input]:border-input [&_.input]:bg-surface [&_.input]:px-3 [&_.input]:py-2 [&_.input]:text-sm [&_.input]:outline-none focus-within:[&_.input]:border-primary">
        {children}
      </div>
    </label>
  );
}
