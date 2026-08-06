/**
 * Marketing sections for the homepage, below the live explorer.
 *
 * Structure follows the pattern that converts for tools like this: what it
 * does (concrete, one capability per block) → proof → how you start → price →
 * how your data is handled → objections → one closing action.
 *
 * Copy rules, inherited from the rest of the app:
 *   * Claims must be true of the code today. No "coming soon" dressed as shipped.
 *   * Never state a tax conclusion. Evidence, not determinations.
 *   * Downsides stay visible — the honest note is the differentiator, not a risk.
 */
import { Link } from "@tanstack/react-router";
import {
  CalendarClock,
  Check,
  FileText,
  Lock,
  MapPinned,
  ShieldCheck,
} from "lucide-react";
import { PricingTable } from "@/components/PricingTable";
import { FaqList, PRODUCT_FAQ } from "./Faq";
import { APP_NAME } from "@/lib/app";
import { CITIES } from "@/lib/cities";

type Feature = {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  icon: typeof MapPinned;
  to: string;
  cta: string;
};

const FEATURES: Feature[] = [
  {
    eyebrow: "Tracking",
    title: "Know your Schengen position today, not after the fact",
    body: "Log a trip and the rolling 90/180 calculation updates immediately — days used, days left, and the date your allowance next frees up. Entry and exit days both count as full days, the way border officers count them.",
    points: [
      "Rolling 90/180 engine, tested across timezones",
      "Per-country tax-residency day counters against each threshold",
      "Works signed out and offline, on your device",
    ],
    icon: CalendarClock,
    to: "/tracker",
    cta: "Open the tracker",
  },
  {
    eyebrow: "Planning",
    title: "Answer “can I go?” before you book, not after",
    body: "Pick a date and see exactly how long you could stay if you entered then. When a limit is closing in, the border-run planner ranks every viable exit by what it costs you to be there — not by what pays us.",
    points: [
      "“If I enter on 3 October, how long can I stay?”",
      "Every exit ranked, with real monthly costs",
      "Alerts at 75% and 90% of any threshold",
    ],
    icon: MapPinned,
    to: "/plan",
    cta: "Plan a move",
  },
  {
    eyebrow: "Records",
    title: "The year-end document your accountant actually asks for",
    body: "A presence record per country: days counted, the threshold that applies, the tax-year basis, every entry and exit, and the gaps in your own data. It prints how the days were counted and which method version produced the figures, so a number queried months later can be reproduced.",
    points: [
      "PDF and CSV, formatted for an adviser",
      "Counting method and dataset date printed on every page",
      "States the record, never a verdict on your residency",
    ],
    icon: FileText,
    to: "/record",
    cta: "See your record",
  },
  {
    eyebrow: "Documents",
    title: "Your passport, openable in a queue with no signal",
    body: "Passport, visa approvals and insurance certificates in a private bucket only your account can read, cached on your device so they open when you need them most. Opening the vault needs a second factor, so a stolen password is not enough.",
    points: [
      "Second factor required for server access",
      "Cached offline for immigration halls",
      "Expiry warnings before a document lapses",
    ],
    icon: Lock,
    to: "/record/vault",
    cta: "Open the vault",
  },
];

export function LandingSections() {
  return (
    <div className="space-y-16 py-8">
      {FEATURES.map((f, i) => (
        <FeatureBlock key={f.title} feature={f} flip={i % 2 === 1} />
      ))}

      <StartSection />
      <PricingSection />
      <PrivacySection />

      <section className="space-y-3">
        <SectionHeading eyebrow="Questions" title="Before you sign up" />
        <FaqList items={PRODUCT_FAQ} />
      </section>

      <ClosingCta />
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="max-w-2xl">
      <div className="label-xs text-primary">{eyebrow}</div>
      <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      {lead ? <p className="mt-2 text-sm text-muted-foreground">{lead}</p> : null}
    </div>
  );
}

function FeatureBlock({ feature, flip }: { feature: Feature; flip: boolean }) {
  const Icon = feature.icon;
  return (
    <section className="grid items-center gap-6 md:grid-cols-2">
      <div className={flip ? "md:order-2" : undefined}>
        <div className="label-xs text-primary">{feature.eyebrow}</div>
        <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{feature.title}</h2>
        <p className="mt-3 text-sm text-muted-foreground">{feature.body}</p>
        <ul className="mt-4 space-y-2 text-sm">
          {feature.points.map((p) => (
            <li key={p} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <Link
          to={feature.to}
          className="mt-5 inline-flex rounded-md border border-border px-3.5 py-2 text-sm font-medium hover:border-primary hover:text-primary"
        >
          {feature.cta}
        </Link>
      </div>
      {/* Deliberately not a screenshot: shipping stale marketing images is a
          maintenance debt, and an abstract panel never lies about the UI. */}
      <div className={flip ? "md:order-1" : undefined}>
        <div className="panel flex aspect-[4/3] items-center justify-center bg-surface">
          <Icon className="h-16 w-16 text-primary/40" aria-hidden />
        </div>
      </div>
    </section>
  );
}

function StartSection() {
  const steps = [
    {
      when: "Minute 1",
      title: "Log your last trip",
      body: "No account, no card. Enter one trip and the Schengen counter tells you where you stand right now.",
    },
    {
      when: "Day 1",
      title: "See the year ahead",
      body: "Add the trips you already have booked. The compliance calendar shows which thresholds you approach and when.",
    },
    {
      when: "Year end",
      title: "Hand over the record",
      body: "Export the presence report as PDF or CSV and give it to your adviser, with the counting method printed on it.",
    },
  ];
  return (
    <section className="space-y-4">
      <SectionHeading
        eyebrow="Your start"
        title="Useful in one minute, not one onboarding call"
        lead="Nothing to install and nobody to talk to. The tracker is the product; everything else is built on top of it."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.title} className="panel p-4">
            <div className="label-xs text-primary">{s.when}</div>
            <h3 className="mt-1 text-sm font-semibold">{s.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="pricing" className="space-y-4 scroll-mt-20">
      <SectionHeading
        eyebrow="Pricing"
        title="The price is on the page"
        lead="No demo call, no “contact us for pricing”. Free to put your data in, paid to get the answers out — and the emergency unlock means you are never trapped behind the paywall when a limit is closing in."
      />
      <PricingTable compact />
      <div className="text-center">
        <Link to="/pricing" className="text-sm text-primary underline-offset-2 hover:underline">
          Full plan comparison and billing questions
        </Link>
      </div>
    </section>
  );
}

function PrivacySection() {
  const items = [
    {
      title: "EU hosting, row-level security",
      body: "Your data sits in the EU, and database policies mean your rows are readable only by your account — verified by simulating one user trying to read another's.",
    },
    {
      title: "No analytics, no tracking scripts",
      body: "There are none in the app at all. Your location is fuzzed to roughly a kilometre, hidden below a crowd threshold, and you are invisible on the radar unless you switch it on.",
    },
    {
      title: "A second factor on your documents",
      body: "The vault holds passports and IDs, so opening it needs more than a password. Nothing else in the app asks for a code.",
    },
    {
      title: "Export and deletion, in the app",
      body: "Download everything you hold as JSON, or delete your account and its files outright. Both are buttons, not support tickets.",
    },
  ];
  return (
    <section className="space-y-4">
      <SectionHeading
        eyebrow="Your data"
        title="Sensitive by nature, handled that way"
        lead="This app knows where you have been and holds your passport. That is worth being specific about."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((i) => (
          <div key={i.title} className="panel flex items-start gap-3 p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <div>
              <h3 className="text-sm font-semibold">{i.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{i.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="panel p-6 text-center">
      <h2 className="text-lg font-semibold tracking-tight">
        Find out where you actually stand
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
        One trip is enough to get a real answer. {CITIES.length} cities, every Schengen day
        counted, and nothing to sign up for first.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link
          to="/tracker"
          className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Log your first trip
        </Link>
        <Link to="/pricing" className="rounded-md border border-border px-4 py-2.5 text-sm font-medium">
          See pricing
        </Link>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        {APP_NAME} produces a record of your travel. It does not determine your tax status — that
        is a question for a qualified adviser.
      </p>
    </section>
  );
}
