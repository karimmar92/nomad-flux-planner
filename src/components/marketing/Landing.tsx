/**
 * Marketing landing page.
 *
 * Lives in components/, NOT in routes/, because it is rendered by TWO routes:
 * "/" for signed-out visitors and "/landing" as an alias. Exporting a
 * component from a route file defeats TanStack Router's code splitting — the
 * build warns about it explicitly — and the router's own docs ask for exactly
 * this separation.
 *
 * ── VOICE ──────────────────────────────────────────────────────────────
 *
 * Outcomes, not features. "Rolling 90/180, counted properly" describes the
 * machinery; "You will know the date you have to leave" describes what
 * changes for the reader. The rule applied throughout: if a heading would
 * still make sense in a changelog, it is not a benefit.
 *
 * Emotion comes from SPECIFIC MOMENTS, never from adjectives. This audience
 * shares one vivid experience — standing at a desk while someone slowly turns
 * the pages of your passport — and naming it does more than any amount of
 * "seamless" or "effortless". There is not a single superlative on this page,
 * on purpose.
 *
 * THE CONSTRAINT THAT OVERRIDES ALL OF THE ABOVE: every factual claim stays
 * exactly as true as it was. This product's whole position is telling people
 * uncomfortable truths about their own situation; copy that oversells would
 * cost more credibility than it buys attention. Warmer framing, identical
 * facts. Where the old copy overstated something (see the privacy section) it
 * was corrected rather than polished.
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
  Plane,
  ShieldCheck,
  Wallet,
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
      {/* ── Trust bar ─────────────────────────────────────────────────
          Reassurance before the ask. Same three facts as before, written as
          promises to the reader rather than as a spec line. */}
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pt-2 text-center text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
        Your data stays in the EU · Works with no signal · Nobody is tracking you
      </p>

      {/* ── Hero ────────────────────────────────────────────────────
          Two columns on desktop: the claim on the left, a WORKING calculator
          on the right. Letting someone get their own real number before any
          signup ask is worth more than any amount of copy — and the effort
          they spend typing their dates is what makes saving it feel like
          continuing rather than converting.

          The headline names the moment, not the mechanism. Everyone in this
          audience has stood at that desk. The subhead carries the search
          entities (Schengen 90/180, tax residency, 183 days) so the emotional
          H1 costs nothing in ranking — the route's title tag already leads
          with "Schengen 90/180 Calculator". */}
      <section className="grid items-center gap-8 md:grid-cols-2">
        <Reveal className="space-y-5">
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Know your days. <span className="sheen">Before the officer does.</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
            The Schengen 90/180 rule, the 183-day tax residency line, the US 330-day exclusion, the
            UK residence test — {APP_NAME} counts all of them from the same trip history. You will
            know the date you have to leave long before it becomes a problem, and you will have the
            record to prove where you were.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/tracker"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:bg-primary/90 hover:-translate-y-0.5"
            >
              Count my days — free
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/explore"
              className="rounded-lg border border-border px-5 py-2.5 text-center text-sm font-medium transition-colors hover:bg-surface-2"
            >
              See where I could go
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            Nothing to sign up for. Log as many trips as you like, free, for as long as you like.
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
          sceptical reader checks. The labels changed from what each number IS
          to what it MEANS for the reader; the numbers did not. */}
      <Reveal as="section" className="content-auto grid gap-3 sm:grid-cols-4">
        {[
          {
            k: (
              <>
                <CountUp to={cityCount} />
              </>
            ),
            v: "cities, with what they cost and how long you may stay",
          },
          {
            k: (
              <>
                <CountUp to={4} />
              </>
            ),
            v: "rules, all counted from the same trips",
          },
          {
            k: (
              <>
                <CountUp to={0} />
              </>
            ),
            v: "trackers following you around the web",
          },
          { k: SEED_LAST_VERIFIED, v: "the day every figure was last checked" },
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
          qualification. Both options are written in the reader's own words,
          as they would describe themselves rather than as segments. */}
      <Reveal as="section" className="content-auto space-y-3">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          Which one is you?
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/tracker"
            className="panel group space-y-2 p-5 transition-shadow hover:shadow-[0_6px_20px_rgba(0,0,0,0.07)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plane className="h-4 w-4" aria-hidden />
            </span>
            <h3 className="text-base font-semibold">I am the one at the border</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You will always know how long you can stay, when you have to move, where is worth
              moving to — and at the end of the year, you will not have to reconstruct any of it
              from old boarding passes.
            </p>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              Start with my last few trips
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
            <h3 className="text-base font-semibold">I am responsible for people who are</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You will see permanent-establishment exposure building up country by country, with an
              audit trail, before it becomes a filing. Your people keep a private account you cannot
              see into — which is the only reason they will keep it accurate.
            </p>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-info">
              See how it works for a team
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
          </Link>
        </div>
      </Reveal>

      {/* ── The problem ───────────────────────────────────────────────
          The opening line does real persuasive work: it moves the cause of
          the mistake from the reader's carelessness to the rules' design.
          People do not buy a solution to a problem they feel stupid about. */}
      <Reveal as="section" className="content-auto panel space-y-3 p-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          One trip. Four different correct answers.
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Almost nobody gets this wrong through carelessness. They get it wrong because the rules
          genuinely contradict each other, and every contradiction below costs somebody real money
          every year.
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

      {/* ── Outcomes ─────────────────────────────────────────────────
          Was "What it does", with headings that described the machinery. Each
          heading is now the sentence the reader could say about their own life
          afterwards. The bodies keep every specific — the specifics are what
          make the promise believable rather than aspirational. */}
      <Reveal as="section" className="content-auto space-y-6">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          What changes
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Feature
            icon={<CalendarClock className="h-4 w-4" />}
            title="You will know the date you have to leave"
            body="Days used, days left today, and the first date you could come back for a clean 90 — counted on the rolling window rather than the one people assume. Long-stay visas and residence permits are kept separate, as they should be."
          />
          <Feature
            icon={<Globe2 className="h-4 w-4" />}
            title="You will not become a tax resident by accident"
            body="Every country you have set foot in, counted against its own threshold and its own tax year. South Africa runs March to February. Mauritius, July to June. Getting the calendar wrong is how people cross a line they never saw."
          />
          <Feature
            icon={<Plane className="h-4 w-4" />}
            title="When you have to move, you will know where"
            body="Somewhere you can legally be, that you can afford, ranked by the maths rather than by the cheapest flight. Non-Schengen options come first, because they are the ones that stop the clock."
          />
          <Feature
            icon={<FileText className="h-4 w-4" />}
            title="Your accountant will get a straight answer"
            body="Days per country per tax year, exportable, with the gaps and uncertainties flagged rather than quietly smoothed over. Evidence for them to work from — the conclusion stays theirs to draw."
          />
          <Feature
            icon={<WifiOff className="h-4 w-4" />}
            title="It works in the queue at passport control"
            body="Your trips, every city and the visa rules are already on the device. No roaming, no signal, no loading spinner at the moment you actually need the number."
          />
          <Feature
            icon={<Wallet className="h-4 w-4" />}
            title="You will know what a month there really costs"
            body={`Rent, coworking, groceries and transport for ${cityCount} cities, each carrying the date it was last checked. Where a figure has gone stale, it says so instead of pretending.`}
          />
        </div>
      </Reveal>

      {/* ── Why trust the maths ─────────────────────────────────────── */}
      <Reveal as="section" className="content-auto panel space-y-3 p-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Why you can trust the number
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          A wrong count here is not a cosmetic bug — an overstay can mean a multi-year entry ban,
          and you would find out at the worst possible moment. So the counting is one pure function
          with its own test suite, not logic scattered across screens where it can quietly disagree
          with itself.
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden />
            {/* Deliberately not a hard number — a count in marketing copy goes
                stale the moment a test is added and nobody updates the page. */}
            Covered by a dedicated test suite, including the trap that catches most people: leaving
            and coming straight back, believing the window reset.
          </li>
          <li className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden />
            Run under opposing timezones (UTC+12 and UTC−7) with identical results, so your dates
            never shift by a day depending on where you happen to be standing.
          </li>
          <li className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden />
            Every date written with the month as a word — never 03/04/2026, which means two
            different days depending on who is reading it.
          </li>
        </ul>
        <p className="pt-1 text-xs text-muted-foreground">
          City data last verified {SEED_LAST_VERIFIED}. Visa and tax information is provided for
          guidance and is not legal or tax advice.
        </p>
      </Reveal>

      {/* ── Getting started ─────────────────────────────────────────── */}
      <Reveal as="section" className="content-auto space-y-5">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          You are about a minute from an answer
        </h2>
        <ol className="space-y-4">
          {[
            [
              "Right now",
              "Put in your last few trips",
              "No account, no setup, no email. Entry and exit dates are enough, and the rolling window appears as you type. If you have three years of history, the last six months is all the window can actually see.",
            ],
            [
              "Two minutes in",
              "Add your passport and what you earn",
              "Now the numbers are yours rather than generic: what your nationality is allowed, and what would be left in your account at the end of a month in each city.",
            ],
            [
              "From then on",
              "Stop having to remember",
              "You get told at 75% and 90% of any limit, and when a deadline forces a move, the options are already ranked. Nothing to check, nothing to diarise.",
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
      <Reveal as="section" className="content-auto space-y-4">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          Free to log. Paid to plan.
        </h2>
        <p className="mx-auto max-w-xl text-center text-sm leading-relaxed text-muted-foreground">
          Your record of where you have been stays free forever. It is your history, and charging
          you to look at it would be indefensible. What you pay for is looking forward: planning the
          next move, being warned early, and the reports you hand to somebody else.
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
          If you are already over a limit, or within seven days of one, the full exit list opens
          regardless of what you pay. Somebody about to overstay is not somebody to sell to.
        </p>
      </Reveal>

      {/* ── Privacy ─────────────────────────────────────────────────
          CORRECTED, not just reworded. The old copy said location was
          "rounded to roughly a kilometre before it leaves your device", which
          described the design of the networked radar rather than what ships:
          radar-store.ts writes to localStorage and nothing syncs it, so no
          coordinate leaves the device at all. Same error was on the privacy
          policy and was fixed there; a landing page and a privacy policy
          disagreeing about location data is exactly the inconsistency a
          regulator or a careful reader finds first. */}
      <Reveal as="section" className="content-auto panel space-y-4 p-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          You are handing over your passport and your whereabouts
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          That deserves more than a policy page nobody reads, so here is what actually happens to
          it.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TrustItem
            title="It stays in Europe"
            body="The database is in Frankfurt. Your travel history, your income and your documents do not leave the EU."
          />
          <TrustItem
            title="Nobody is watching you use it"
            body="There is no analytics script on any page. Nothing follows you elsewhere, and there is nothing to sell because none of it is collected."
          />
          <TrustItem
            title="Your location never leaves the device"
            body="The community radar runs entirely on your phone today — no coordinate is sent to us at all. When the networked version arrives you will be invisible by default, and this page will say so before it ships, not after."
          />
          <TrustItem
            title="You can take it all back"
            body="Download everything as a file, or delete your account and every document with it. Both are buttons on your profile, not a support request somebody has to approve."
          />
        </div>
      </Reveal>

      {/* ── Honest limits ────────────────────────────────────────────
          What a mature SaaS page fills with a logo cloud and a G2 badge.
          Written as disclosure, not apology: this product's entire positioning
          is telling people uncomfortable truths about their own situation, so
          concealing its own would undercut everything above it. It also
          pre-empts the objection rather than letting a sceptic form it alone.

          LEFT ALMOST UNTOUCHED in the emotional pass, deliberately. This
          section only works because it reads flatter than everything around
          it. Warm it up and it starts to sound like a technique. */}
      <Reveal as="section" className="content-auto panel space-y-4 border-primary/30 p-6">
        <div>
          <div className="label-xs text-primary">Straight answer</div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            Built by one person. Here is exactly where that shows.
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          There are no customer logos on this page because there are no customers yet. You would
          work that out within a week, and a product about getting the awkward details right should
          not open with a decorative lie.
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
                "The community radar is a preview that runs on your own device. It stays that way until enough people in one city have asked for it to be worth switching on.",
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
              "No. Log your trips and see exactly where you stand without signing up — it all lives on your device. Make an account when you want it backed up or on your phone too, and everything you already logged comes with you automatically.",
            ],
            [
              "Is this legal advice?",
              "No, and it takes care not to sound like it. You are told your recorded day counts and the published thresholds. You are never told that you are tax resident somewhere — that turns on far more than days, and it is a question for someone qualified to answer it.",
            ],
            [
              "How accurate are the cost figures?",
              "They are researched estimates carrying the date they were last checked, based on one person living mid-range: a private one-bedroom centrally, cooking about half your meals, one coworking desk. Where a currency moves fast, the figure is marked low-confidence rather than presented as fact.",
            ],
            [
              "What happens if I lose my phone?",
              "With an account, nothing — your trips are waiting on the next device you sign in from. Without one, they only ever existed on that phone. The app warns you about this once you have enough logged to actually miss.",
            ],
            [
              "Which countries are covered?",
              `${cityCount} cities across Europe, Asia, Latin America, Africa and the Middle East, each with its visa and tax rules. The day counting itself works for anywhere you go, whether or not the city is on that list.`,
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

      {/* ── Closing CTA ─────────────────────────────────────────────
          A question, not a slogan. Most readers genuinely cannot answer it,
          and noticing that is more motivating than anything we could assert. */}
      <Reveal as="section" className="content-auto panel space-y-4 p-8 text-center">
        <h2 className="text-xl font-semibold tracking-tight">
          So — how many days do you have left right now?
        </h2>
        <p className="mx-auto max-w-lg text-sm leading-relaxed text-muted-foreground">
          Most people are fairly sure. Fairly sure is what a three-year entry ban is made of. Put in
          your last few trips and find out properly — about a minute, no account, nothing to cancel.
        </p>
        <Link
          to="/tracker"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Find out
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </Reveal>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
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
