/**
 * Marketing landing page.
 *
 * Lives in components/, NOT in routes/, because it is rendered by TWO routes:
 * "/" for signed-out visitors and "/landing" as an alias. Exporting a
 * component from a route file defeats TanStack Router's code splitting — the
 * build warns about it explicitly — and the router's own docs ask for exactly
 * this separation.
 *
 * DELIBERATELY OMITTED: customer logo cloud, star rating, named case study,
 * testimonials. Those sections exist on mature reference sites because those
 * companies have customers. We have none yet. An empty or invented social-proof
 * band is worse than no band — it is the first thing a sceptical visitor
 * checks, and a fabricated one is both a lie and trivially disprovable.
 */
import { Link } from "@tanstack/react-router";
import { PricingTable } from "@/components/PricingTable";
import { RuleCalculator } from "@/components/marketing/RuleCalculator";
import { Reveal, CountUp } from "@/components/marketing/Reveal";
import { StickyCta } from "@/components/marketing/StickyCta";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  FileText,
  Globe2,
  Lock,
  Plane,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { APP_NAME } from "@/lib/app";
import { CITIES, SEED_LAST_VERIFIED } from "@/lib/cities";
import { RULE_PAGES } from "@/config/rule-pages";

export function Landing() {
  const cityCount = CITIES.length;

  // Marketing scale, not app scale.
  //
  // This was max-w-4xl (896px) with space-y-16 (64px). Inside an app shell
  // that read as a settings screen rather than a landing page — the copy was
  // fine, the proportions were wrong. Reference marketing sites run ~1200px
  // wide with 96-128px between sections, and that whitespace is most of what
  // signals "this is a product worth paying for".
  //
  // NOTE: a `{/* … */}` comment cannot go directly inside `return (` — the
  // braces parse as an object literal and the build fails. Hence `//` here.
  return (
    <div className="mx-auto max-w-6xl space-y-24 pb-24 sm:space-y-28">
      <StickyCta />
      {/* ── Trust bar ───────────────────────────────────────────────── */}
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pt-2 text-center text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
        Hosted in the EU (Frankfurt) · Works offline · No tracking or analytics
      </p>

      {/* ── Hero ────────────────────────────────────────────────────
          Two columns on desktop: the claim on the left, a WORKING calculator
          on the right. Letting someone get their own real number before any
          signup ask is worth more than any amount of copy — and the effort
          they spend typing their dates is what makes saving it feel like
          continuing rather than converting. */}
      <section className="grid items-center gap-8 md:grid-cols-2">
        <Reveal className="space-y-5">
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Every rule that decides your life abroad is{" "}
            <span className="sheen">a day count</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
            Visa limits, tax residency, the US 330-day exclusion, the UK residence test —
            all the same arithmetic against different thresholds, with conventions that
            contradict each other. Schengen counts your arrival day. The FEIE does not.
            {" "}{APP_NAME} runs every rule against one trip history, warns you before you
            cross a line, and keeps the record you will need when someone asks where you
            have been.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/tracker"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:bg-primary/90 hover:-translate-y-0.5"
            >
              Start tracking — free
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/explore"
              className="rounded-lg border border-border px-5 py-2.5 text-center text-sm font-medium transition-colors hover:bg-surface-2"
            >
              Browse {cityCount} cities
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            No account needed to start. Unlimited trip logging, free forever.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <RuleCalculator />
        </Reveal>
      </section>

      {/* ── Proof strip ──────────────────────────────────────────────
          Numbers instead of testimonials. Every figure here is traceable to
          the repo: the dataset size, its verification date, the rule the
          engine implements. Invented social proof is the first thing a
          sceptical reader checks. */}
      <Reveal as="section" className="content-auto grid gap-3 sm:grid-cols-4">
        {[
          { k: <><CountUp to={cityCount} /></>, v: "cities with costs, visa and tax rules" },
          { k: <><CountUp to={4} /></>, v: "rules counted from one trip history" },
          { k: <><CountUp to={0} /></>, v: "tracking scripts, on any page" },
          { k: SEED_LAST_VERIFIED, v: "data last verified" },
        ].map((s2, i) => (
          <div key={i} className="panel px-4 py-3 text-center">
            <div className="num text-xl font-semibold text-primary">{s2.k}</div>
            <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{s2.v}</div>
          </div>
        ))}
      </Reveal>

      {/* ── Audience split ───────────────────────────────────────────
          Placed AFTER the hero, the calculator and the proof strip — never
          before. A choice offered before someone knows what the product is
          raises bounce; the same choice after they have seen it work is a
          qualification. */}
      <Reveal as="section" className="content-auto space-y-3">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">Which one are you?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/tracker"
            className="panel group space-y-2 p-5 transition-shadow hover:shadow-[0_6px_20px_rgba(0,0,0,0.07)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plane className="h-4 w-4" aria-hidden />
            </span>
            <h3 className="text-base font-semibold">I work from more than one country</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Day counting across every rule, tax thresholds per country, where to
              go when a limit forces you out, and a record you can hand to an
              accountant.
            </p>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              Open the tracker
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
          </Link>

          <Link
            to="/business"
            className="panel group space-y-2 p-5 transition-shadow hover:shadow-[0_6px_20px_rgba(0,0,0,0.07)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-info-muted text-info">
              <Building2 className="h-4 w-4" aria-hidden />
            </span>
            <h3 className="text-base font-semibold">I manage people who do</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Permanent-establishment exposure across your team, per country, with
              an audit trail — and every employee keeps a personal account you
              cannot see into.
            </p>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-info">
              For teams
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
          </Link>
        </div>
      </Reveal>

      {/* ── The problem ─────────────────────────────────────────────── */}
      <Reveal as="section" className="content-auto panel space-y-3 p-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          One trip. Four different correct answers.
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The rules do not agree with each other, and each disagreement costs somebody
          money every year:
        </p>
        <ul className="space-y-2.5 text-sm">
          {[
            [
              "Schengen counts your arrival day. The FEIE does not.",
              "Land at 23:50 and you have burned a full Schengen day — but that day will never count toward the 330 you need for the US exclusion.",
            ],
            [
              "Leaving does not reset the Schengen clock.",
              "Days fall out of the window only by ageing past 180 days. Flying to Serbia and back does nothing at all.",
            ],
            [
              "The tax year is not January to December.",
              "South Africa runs March to February, Mauritius July to June, the UK 6 April to 5 April. Counting on the wrong calendar produces a confident wrong answer.",
            ],
            [
              "Some rules count up, not down.",
              "The 330-day US test is a target to reach, not a limit to avoid. Missing it by one day can cost more than $120,000 of excluded income.",
            ],
          ].map(([bold, rest]) => (
            <li key={bold} className="flex gap-2.5">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
              <span>
                <span className="font-medium">{bold}</span>{" "}
                <span className="text-muted-foreground">{rest}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 pt-1">
          {RULE_PAGES.map((r) => (
            <Link
              key={r.slug}
              to="/rules/$slug"
              params={{ slug: r.slug }}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
            >
              {r.title.split("—")[0]!.trim()} →
            </Link>
          ))}
        </div>
      </Reveal>

      {/* ── What it does ────────────────────────────────────────────── */}
      <Reveal as="section" className="content-auto space-y-6">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          What it does
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Feature
            icon={<CalendarClock className="h-4 w-4" />}
            title="Rolling 90/180, counted properly"
            body="Days used, days remaining today, and the earliest date you could re-enter for a full 90. Long-stay visas and residence permits are counted separately, as they should be."
          />
          <Feature
            icon={<Globe2 className="h-4 w-4" />}
            title="Tax residency counters"
            body="Every country you visit, against its own threshold — including the ones whose tax year is not January to December. South Africa runs March–February; Mauritius July–June."
          />
          <Feature
            icon={<Plane className="h-4 w-4" />}
            title="Where to go next"
            body="When a deadline forces you out, ranked exits by visa maths and cost of living rather than ticket price. Non-Schengen options surface first, because they stop the clock."
          />
          <Feature
            icon={<FileText className="h-4 w-4" />}
            title="A record you can hand to an accountant"
            body="Day counts per country per tax year, exportable, with the gaps and uncertainties flagged rather than hidden. Evidence, not a verdict — your adviser draws the conclusion."
          />
          <Feature
            icon={<WifiOff className="h-4 w-4" />}
            title="Works with no signal"
            body="All cities, your trips and your visa requirements are cached on the device. It works in an immigration queue with no roaming, which is exactly where you need it."
          />
          <Feature
            icon={<Lock className="h-4 w-4" />}
            title="Costs for every city"
            body={`Rent, coworking, groceries and transport for ${cityCount} cities, each carrying the date it was last verified. Stale numbers are labelled as stale.`}
          />
        </div>
      </Reveal>

      {/* ── Why trust the maths ─────────────────────────────────────── */}
      <Reveal as="section" className="content-auto panel space-y-3 p-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Why trust the counting</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Getting this wrong is not a small bug — an overstay can mean a multi-year
          entry ban. So the day-counting engine is a single pure function with a test
          suite, not logic scattered through screens.
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden />
            {/* Deliberately not a hard number — a count in marketing copy goes
                stale the moment a test is added and nobody updates the page. */}
            Covered by a dedicated test suite, including the trap where people leave
            and immediately re-enter believing the window reset.
          </li>
          <li className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden />
            Run under opposing timezones (UTC+12 and UTC−7) with identical results, so
            a date never shifts by a day depending on where you are.
          </li>
          <li className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden />
            Every date shown with the month as a word — never 03/04/2026, which means
            two different days depending on who is reading it.
          </li>
        </ul>
        <p className="pt-1 text-xs text-muted-foreground">
          City data last verified {SEED_LAST_VERIFIED}. Visa and tax information is
          provided for guidance and is not legal or tax advice.
        </p>
      </Reveal>

      {/* ── Getting started ─────────────────────────────────────────── */}
      <Reveal as="section" className="content-auto space-y-5">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          Getting started
        </h2>
        <ol className="space-y-4">
          {[
            [
              "Right now",
              "Log your last few trips",
              "No account, no setup. Enter entry and exit dates and the rolling window is calculated immediately. If you have three years of history, start with the last six months — that is what the window actually looks at.",
            ],
            [
              "Two minutes in",
              "Add your passport and income",
              "Everything becomes personal: visa allowances for your nationality, and what each city would leave you at the end of the month.",
            ],
            [
              "When it matters",
              "Get warned before you trip a threshold",
              "Alerts at 75% and 90% of any limit, and ranked exits when a deadline forces a move.",
            ],
          ].map(([when, title, body]) => (
            <li key={title} className="panel flex gap-4 p-4">
              <span className="label-xs w-24 shrink-0 pt-0.5">{when}</span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                  {body}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </Reveal>

      {/* ── Pricing ─────────────────────────────────────────────────── */}
      <Reveal as="section" className="content-auto space-y-4" >
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          Free to log. Paid to plan.
        </h2>
        <p className="mx-auto max-w-xl text-center text-sm leading-relaxed text-muted-foreground">
          Logging trips is free forever and always will be — the record is yours and
          holding it hostage would be indefensible. Pro is for the forward-looking
          parts: planning ahead, alerts, reports and exports.
        </p>
        {/* Rendered from src/config/pricing.ts. This section used to hold a
            hand-written two-tier table at €9 — it drifted the moment pricing
            changed, and a landing page quoting a price the checkout does not
            charge is the worst possible inconsistency to ship. One source. */}
        <PricingTable compact />
        <div className="text-center">
          <Link to="/pricing" className="text-sm text-primary underline-offset-2 hover:underline">
            Full plan comparison
          </Link>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          If you are within seven days of a deadline or already over a limit, the full
          exit list is shown regardless of plan. Someone about to overstay is not
          someone to charge.
        </p>
      </Reveal>

      {/* ── Privacy ─────────────────────────────────────────────────── */}
      <Reveal as="section" className="content-auto panel space-y-4 p-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Sensitive data, specific rules
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TrustItem
            title="Hosted in the EU"
            body="Database in Frankfurt. Your travel history, income and documents stay in the EU."
          />
          <TrustItem
            title="No tracking, no analytics"
            body="There is no analytics script in this app. Nothing follows you, and there is no data to sell because none is collected."
          />
          <TrustItem
            title="Location is never precise"
            body="If you use the community radar, your position is rounded to roughly a kilometre before it leaves your device, and no history is kept. Invisible by default."
          />
          <TrustItem
            title="Export or delete, one tap"
            body="Download everything as JSON, or delete your account and every file with it. Both are in your profile, not behind a support email."
          />
        </div>
      </Reveal>

      {/* ── Honest limits ────────────────────────────────────────────
          What a mature SaaS page fills with a logo cloud and a G2 badge.
          Written as disclosure, not apology: this product's entire positioning
          is telling people uncomfortable truths about their own situation, so
          concealing its own would undercut everything above it. It also
          pre-empts the objection rather than letting a sceptic form it alone. */}
      <Reveal as="section" className="content-auto panel space-y-4 border-primary/30 p-6">
        <div>
          <div className="label-xs text-primary">Straight answer</div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            Built by one person. Here is exactly where that shows.
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          There are no customer logos on this page because there are no customers
          yet. You would work that out within a week, and a product about getting
          the awkward details right should not open with a decorative one.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">What is solid</h3>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {[
                "The day-counting engines have their own test suites, run under opposing timezones so a date never shifts by one depending on where you are.",
                `${cityCount} cities with visa rules, tax thresholds and costs — each carrying the date it was last verified.`,
                "Everything works offline. It is built for an immigration queue with no roaming.",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-semibold">What is not done</h3>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {[
                "Cost figures are researched estimates, not a live feed. Volatile currencies are marked low-confidence rather than presented as fact.",
                "The community runs in one city while it finds its feet, not thirty.",
                "Nothing here is legal or tax advice, and the app never tells you that you are tax resident somewhere — only what your recorded days are against the published threshold.",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground"
                    aria-hidden
                  />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>

      {/* ── FAQ ─────────────────────────────────────────────────────── */}
      <Reveal as="section" className="content-auto space-y-3">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          Common questions
        </h2>
        <div className="space-y-2">
          {[
            [
              "Do I need an account?",
              "No. You can log trips and see your Schengen status without signing up — everything is stored on your device. Create an account when you want it backed up or available on your phone as well, and anything you already logged is uploaded automatically.",
            ],
            [
              "Is this legal advice?",
              "No, and it deliberately avoids sounding like it. The app tells you your recorded day counts and the published thresholds. It never tells you that you are tax resident somewhere — that depends on factors beyond day counting, and it is a question for a qualified adviser.",
            ],
            [
              "How accurate are the cost figures?",
              "They are researched estimates with a visible last-verified date, based on a mid-range single person: a private one-bedroom in a central area, cooking about half of meals, one coworking desk. Volatile currencies are marked low-confidence rather than presented as fact.",
            ],
            [
              "What happens if I lose my phone?",
              "If you have an account, nothing — your trips are on the server and appear on your next device. If you never signed up, they were only ever on that device. The app tells you this once you have trips worth losing.",
            ],
            [
              "Which countries are covered?",
              `${cityCount} cities across Europe, Asia, Latin America, Africa and the Middle East, with the visa and tax rules for each. Day counting works for any country you enter, whether or not it is in the city list.`,
            ],
          ].map(([q, a]) => (
            <details key={q} className="panel group p-4">
              <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">
                {q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </Reveal>

      {/* ── Closing CTA ─────────────────────────────────────────────── */}
      <Reveal as="section" className="content-auto panel space-y-4 p-8 text-center">
        <h2 className="text-xl font-semibold tracking-tight">
          How many Schengen days do you have left right now?
        </h2>
        <p className="mx-auto max-w-lg text-sm leading-relaxed text-muted-foreground">
          Most people are not sure. Log your last few trips and find out in about a
          minute — no account, nothing to cancel.
        </p>
        <Link
          to="/tracker"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Check my days
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </Reveal>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="panel space-y-2 p-5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function TrustItem({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-1">
      <h3 className="flex items-center gap-1.5 text-sm font-medium">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
