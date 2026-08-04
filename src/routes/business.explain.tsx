import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { APP_NAME } from "@/lib/app";

export const Route = createFileRoute("/business/explain")({
  head: () => ({
    meta: [
      { title: `What your company can see | ${APP_NAME} for teams` },
      {
        name: "description",
        content:
          "A plain-language explanation, written to be shared with staff: exactly what an employer can and cannot see when their company provides a Driftly seat.",
      },
      { property: "og:title", content: "What your company can see" },
      {
        property: "og:description",
        content:
          "Country and dates. Day counts. Risk flags. Nothing else — no location, no documents, no income, no browsing.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExplainPage,
});

const VISIBLE = [
  {
    t: "The countries you have been in, and the dates",
    d: "Only what you log yourself. Entry date and exit date, country level.",
  },
  {
    t: "How those days count against thresholds",
    d: "For example, 62 of 183 days in Spain this rolling year, or 41 of 90 Schengen days.",
  },
  {
    t: "A risk flag",
    d: "Clear, approaching a limit, or over one. It is a status on a number, not a judgement about you.",
  },
];

const NOT_VISIBLE = [
  "Where you are right now, or any location more precise than a country",
  "The community radar, your profile, or anyone you connect with",
  "Your income, savings, or any arbitrage calculation you run",
  "Cities you save, compare or browse",
  "Your document vault — passport scans, visas, insurance certificates",
  "Any personal note you write on a trip",
  "Your personal tax report",
];

function ExplainPage() {
  return (
    <div className="max-w-3xl space-y-8 pb-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          What your company can see
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your employer has given you a {APP_NAME} seat. This page explains, plainly, what that
          means. Share it as-is — it is written for the whole team, not for a buyer.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">The short version</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The account is yours. Your company pays for it and can see three things: which countries
          you have logged, on which dates, and how those days count against legal thresholds. That
          is the entire list. Everything else in the app is private to you, including if you use it
          for holidays, and it stays yours if you leave the company.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Visible to your company</h2>
        <ul className="space-y-2">
          {VISIBLE.map((v) => (
            <li key={v.t} className="panel flex gap-3 p-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden />
              <div>
                <div className="text-sm font-medium">{v.t}</div>
                <p className="text-xs text-muted-foreground">{v.d}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Not visible to your company</h2>
        <ul className="space-y-1.5">
          {NOT_VISIBLE.map((n) => (
            <li key={n} className="flex gap-2 text-sm text-muted-foreground">
              <X className="mt-0.5 h-4 w-4 shrink-0 text-negative" aria-hidden />
              {n}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Why it works this way</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Nobody can detect where you are. The compliance picture only exists because people log
          their own trips, and people only log honestly when the tool is genuinely theirs. So this
          was built the other way round from most workplace software: the personal app is the real
          product, and the company dashboard is a narrow export from it.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          You can verify this yourself rather than take our word for it. Open{" "}
          <Link to="/settings/employer-sharing" className="underline">
            Settings → What your company can see
          </Link>
          . That screen runs the exact same database query your employer&rsquo;s dashboard runs, so
          it cannot show you a friendlier version of the truth.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">If you leave</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your account, your travel history and your documents remain yours. Only the link to the
          organisation is severed — by you, or by an admin removing the seat. Nothing of yours is
          deleted, and your company stops seeing new day-counts from that moment.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link
          to="/settings/employer-sharing"
          className="rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-surface-2"
        >
          See exactly what is shared
        </Link>
        <Link
          to="/business"
          className="rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-surface-2"
        >
          {APP_NAME} for teams
        </Link>
      </div>
    </div>
  );
}
