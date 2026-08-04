import { createFileRoute, Link } from "@tanstack/react-router";
import { CITIES } from "@/lib/cities";
import { useProfile, useSavedCities } from "@/lib/store";
import { flagEmoji } from "@/lib/arbitrage";
import { APP_NAME } from "@/lib/app";
import type { IncomeType } from "@/lib/types";
import { EmptyState } from "@/components/Primitives";

export const Route = createFileRoute("/profile")({
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

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Your profile</h1>

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
        Plan: <span className="font-medium capitalize text-foreground">{profile.plan}</span> ·{" "}
        <Link to="/pricing" className="text-primary underline-offset-2 hover:underline">
          See Pro
        </Link>
      </p>
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
