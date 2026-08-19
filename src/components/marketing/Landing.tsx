/**
 * Marketing landing page.
 *
 * Lives in components/, NOT routes/, because two routes render it: "/" for
 * signed-out visitors and "/landing" as an alias. Exporting a component from a
 * route file defeats TanStack Router's code splitting.
 *
 * ── THE DESIGN BRIEF, AND WHAT IT COST ─────────────────────────────────
 *
 * ONE PRIMARY ACTION PER SCREEN. The hero previously had two buttons of
 * near-equal weight plus a sticky bar with a third. Every added choice at the
 * decision point costs conversion, so there is now exactly one filled button
 * per section and everything else is a text link. The sticky CTA is gone: it
 * competed with the hero for the same click and covered content on mobile.
 *
 * THREE FEATURES, NOT SIX. There were six. Nobody reads six. The three kept
 * are the ones that map to a fear someone already has: missing a deadline,
 * tripping a tax line, and having no signal at the moment you need the number.
 *
 * THREE PLANS, NOT FOUR. Starter is deliberately absent from this page. A
 * fourth option in the middle mostly adds deliberation, and the job of this
 * page is to make one choice obvious. /pricing still shows the full table for
 * people who want to compare properly, which is the right place for detail.
 *
 * ── WHY IT LOOKS LIKE THIS ─────────────────────────────────────────────
 *
 * Apple's visual language is mostly restraint plus three specifics: tight
 * tracking at display sizes, layered low-contrast depth with a hairline top
 * highlight, and colour used only where it carries meaning. See the
 * `display-*`, `surface*` and `cta` utilities in styles.css.
 *
 * The neobanking influence is in the data presentation: numbers are the hero,
 * labels are small and quiet, and status is a pill rather than a sentence.
 * That suits a product whose entire value is a number you can trust.
 *
 * ── WHAT IS DELIBERATELY MISSING ───────────────────────────────────────
 *
 * No logo cloud, no star rating, no testimonials, no countdown. There are no
 * customers yet, and an invented social-proof band is the first thing a
 * sceptical reader checks. The honesty section stays for the same reason it
 * always did: it is the most persuasive thing here precisely because it reads
 * flatter than everything around it.
 *
 * Copy follows Wikipedia:Signs of AI writing — no spaced em dashes, no
 * "not just X but Y", no filler triplets, no superlatives.
 */
import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, Check, Globe2, MapPin, WifiOff } from "lucide-react";
import { RuleCalculator } from "@/components/marketing/RuleCalculator";
import { Reveal } from "@/components/marketing/Reveal";
import { FaqList, PRICING_FAQ } from "@/components/marketing/Faq";
import { APP_NAME } from "@/lib/app";
import { CITIES, SEED_LAST_VERIFIED } from "@/lib/cities";
import { RULE_PAGES, ruleLabel } from "@/config/rule-pages";
import { VAT } from "@/config/legal";
import { PlanCardGrid } from "@/components/marketing/PlanCards";
import { useQuery } from "@tanstack/react-query";
import { TestimonialStrip } from "@/components/reviews/TestimonialStrip";
import { listApprovedReviews } from "@/lib/reviews/reviews.functions";

export function Landing() {
  const cityCount = CITIES.length;
  // The "no customers yet" admission below must retire itself the moment
  // there are published reviews, otherwise the honest section becomes the
  // untrue one.
  const { data: reviews } = useQuery({
    queryKey: ["reviews", "approved", "strip"],
    queryFn: () => listApprovedReviews({ data: { limit: 3 } }),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const hasReviews = (reviews?.length ?? 0) > 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4">
      {/* ── HERO ───────────────────────────────────────────────────────
          Headline states the outcome. One sentence of context. One button.
          The calculator sits beside it as the product shot: a working thing
          beats a screenshot, and typing real dates into it is what makes
          saving them later feel like continuing rather than converting. */}
      <section className="section-gap grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <Reveal className="space-y-7">
          <span className="pill">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-positive" aria-hidden />
            Works offline · Hosted in the EU
          </span>

          <h1 className="display-xl text-balance">Never wonder how many days you have left.</h1>

          <p className="lede max-w-lg text-pretty">
            {APP_NAME} counts Schengen, tax residency and the US 330-day test from one trip history,
            and tells you your leave-by date months before it matters.
          </p>

          <div>
            <Link to="/tracker" className="cta">
              Count my days
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              Free. No account. Takes about a minute.
            </p>
          </div>
        </Reveal>

        <Reveal delay={90}>
          <div className="surface-raised p-2 sm:p-3">
            <RuleCalculator />
          </div>
        </Reveal>
      </section>

      {/* ── PROOF ──────────────────────────────────────────────────────
          Three numbers, each traceable to the repo. Numbers are the hero and
          labels are quiet, which is the neobanking pattern and happens to be
          right for a product whose value is a figure you can trust. */}
      <Reveal as="section" className="content-auto grid gap-3 sm:grid-cols-3">
        {[
          { n: "4", l: "rules counted from one history" },
          { n: String(cityCount), l: "cities with the rules already checked" },
          { n: "0", l: "trackers watching you" },
        ].map((s) => (
          <div key={s.l} className="surface px-6 py-7 text-center">
            <div className="num text-4xl font-semibold tracking-tight">{s.n}</div>
            <div className="mt-1.5 text-sm text-muted-foreground">{s.l}</div>
          </div>
        ))}
      </Reveal>

      {/* ── WHAT CHANGES ───────────────────────────────────────────────
          Three, scannable in seconds. Each heading is a sentence the reader
          could say about their own life afterwards, not a capability. */}
      <section className="section-gap">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="display-lg text-balance">Three things stop being your problem.</h2>
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {[
            {
              Icon: CalendarClock,
              title: "You stop guessing your leave-by date.",
              body: `${APP_NAME} counts the rolling 180-day window the way the border does and tells you the last day you can legally stay, months before it matters.`,
            },
            {
              Icon: Globe2,
              title: "You stop crossing tax lines you did not know you were near.",
              body: "Per-country day counters run against each country's real rule, including the ones that measure over any rolling twelve months rather than the calendar year.",
            },
            {
              Icon: WifiOff,
              title: "You stop needing signal to know where you stand.",
              body: "Everything works offline, so the number is on your phone in the queue at the border, not on a server you cannot reach.",
            },
          ].map(({ Icon, title, body }, i) => (
            <Reveal key={title} delay={i * 70}>
              <div className="surface h-full p-7">
                <Icon className="h-5 w-5 text-primary" aria-hidden />
                <h3 className="mt-4 text-base font-semibold tracking-tight text-balance">
                  {title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── ACCOUNT ────────────────────────────────────────────────────
          The account is earned, not walled. The tracker stays open without
          one; this section names what a reader loses by staying local. */}
      <Reveal as="section" className="content-auto surface-raised p-8 sm:p-12">
        <div className="max-w-2xl">
          <h2 className="display-md text-balance">Your history should outlive the phone.</h2>
          <p className="lede mt-4 text-pretty">
            Everything you log lives in one browser on one device. Clear it, lose the phone, or move
            to a new laptop and the record goes with it. A travel record you cannot produce later is
            the one thing you actually needed it for.
          </p>
          <div className="mt-8">
            <Link to="/auth" search={{ next: "/tracker" }} className="cta">
              Create your account
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              Free. Everything you have already logged uploads automatically.
            </p>
          </div>
        </div>
      </Reveal>


      {/* ── SOCIAL PROOF ───────────────────────────────────────────────
          Real reviews from paying customers, surfaced only when they exist. */}
      {hasReviews && (
        <Reveal className="content-auto">
          <TestimonialStrip />
        </Reveal>
      )}

      {/* ── HOW IT WORKS ───────────────────────────────────────────────
          A clear loop plus honest limits. The outcome is the date in your
          hand, not the feature on the screen. */}
      <Reveal as="section" className="content-auto surface border-primary/25 p-8 sm:p-10">
        <div className="label-xs text-primary">How it works</div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">
          Log the trip. See the number. Move before the deadline.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Most people know roughly. {APP_NAME} turns the guess into a date, so you can decide
          before the border decides for you.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { Icon: MapPin, label: "Log a trip", outcome: "One history, every rule." },
            { Icon: CalendarClock, label: "See the countdown", outcome: "Your leave-by date, months early." },
            { Icon: Globe2, label: "Check the thresholds", outcome: "Tax and visa lines before you hit them." },
            { Icon: ArrowRight, label: "Move on plan", outcome: "No panic, no guessing." },
          ].map(({ Icon, label, outcome }, i) => (
            <div key={label} className="surface p-4">
              <div className="flex items-center gap-3">
                <div className="surface-raised flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                  <Icon className="h-4 w-4 text-primary" aria-hidden />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-medium text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-sm font-semibold leading-tight">{label}</h3>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{outcome}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">What you get out of it</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              {[
                "You know your leave-by date months before it matters.",
                "You carry evidence if a border guard or accountant asks.",
                "You decide on your own schedule, not on a deadline.",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-positive" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">What it does not do</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              {[
                "It does not give legal or tax advice. It shows your recorded days against the published threshold.",
                "Cost figures are estimates, not live exchange rates.",
                "The community radar is a preview that runs on your own device.",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          City data last verified {SEED_LAST_VERIFIED}.
        </p>
      </Reveal>

      {/* ── PRICING ────────────────────────────────────────────────────
          After the proof and the honest limits, never before them. */}
      <section className="section-gap">
        <PlanCardGrid billing="monthly" includeFounding />

        <Reveal className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">{VAT.notice}</p>
          <Link
            to="/pricing"
            className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            Compare every plan
          </Link>
        </Reveal>
      </section>


      {/* ── FAQ ────────────────────────────────────────────────────────
          Objections that stand between reading and clicking, nothing else. */}
      <section className="section-gap">
        <Reveal className="mx-auto max-w-2xl">
          <h2 className="display-md mb-8 text-center text-balance">
            Questions people ask before starting
          </h2>
          <FaqList items={PRICING_FAQ} />
        </Reveal>
      </section>

      {/* ── CLOSING ────────────────────────────────────────────────────
          A question the reader cannot answer, then one button. Noticing they
          do not know is more motivating than any claim we could make, and
          there is deliberately nothing else here to click. */}
      <Reveal as="section" className="content-auto pb-24 text-center">
        <div className="surface-raised mx-auto max-w-3xl px-6 py-16 sm:px-12">
          <h2 className="display-lg mx-auto max-w-xl text-balance">
            How many days do you have left right now?
          </h2>
          <p className="lede mx-auto mt-5 max-w-md text-pretty">
            Most people are fairly sure. Fairly sure is what a three-year entry ban is made of.
          </p>
          <div className="mt-9">
            <Link to="/auth" search={{ next: "/tracker" }} className="cta">
              Keep my record safe
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Free. Your trips sync to every device you use.
          </p>
        </div>
      </Reveal>
    </div>
  );
}
