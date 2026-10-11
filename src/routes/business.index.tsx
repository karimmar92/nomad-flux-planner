import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { APP_NAME, LEGAL_DISCLAIMER } from "@/lib/app";
import { submitB2bLead } from "@/lib/org/org.functions";
import { joinWaitlist } from "@/lib/waitlist.functions";
import { submitWaitlist } from "@/lib/waitlist";
import {
  ANNUAL_DISCOUNT_PERCENT,
  MINIMUM_SEATS,
  annualPerSeatMonthly,
  annualTotal,
  monthlyTotal,
  usd,
} from "@/lib/org/pricing";
import { BUSINESS_ROADMAP, BUSINESS_TIERS } from "@/config/business-plans";
import { TRIAL_DAYS } from "@/config/pricing";
import { PE_BENCHMARK_LABEL } from "@/lib/org/presence";

export const Route = createFileRoute("/business/")({
  head: () => ({
    meta: [
      { title: `${APP_NAME} for teams — work-from-anywhere compliance` },
      {
        name: "description",
        content: `Give your team the freedom to work from anywhere and the paperwork that makes it safe. Country day-counts for compliance, a personal account for every employee. Three plans from $${BUSINESS_TIERS[0]!.monthlyUsd} per seat per month, with prices on the page.`,
      },
      { property: "og:title", content: `${APP_NAME} for teams` },
      {
        property: "og:description",
        content:
          "Country day-counts and permanent-establishment exposure for finance, a policy and approval flow for people teams. Three plans, prices published, no demo call.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BusinessPage,
});

const EMPLOYER_SEES = [
  "Country and dates of presence",
  "Day counts against relevant thresholds",
  "Aggregate risk flags",
];

const EMPLOYER_NEVER_SEES = [
  "The community radar or any social activity",
  "Income, savings or arbitrage calculations",
  "Saved cities or anything they browse",
  "The document vault",
  "Personal notes on trips",
  "Precise location, of any kind",
];

function BusinessPage() {
  const [seats, setSeats] = useState(25);
  const [annual, setAnnual] = useState(true);

  return (
    <div className="space-y-10 pb-6">
      <header className="space-y-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> {APP_NAME} for teams
        </span>
        <h1 className="max-w-3xl text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Give your team the freedom to work from anywhere — and the paperwork that makes it safe.
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Every seat comes with a personal account that belongs to your employee, not to you: their
          own visa tracking, with more included on higher plans. You see only the country day-counts
          you need for compliance. They see everything else.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/org"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Start now — no sales call
          </Link>
          <a
            href="#book-a-call"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2"
          >
            Talk to us first
          </a>
          <Link
            to="/business/explain"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2"
          >
            Explain this to your team
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="panel p-4">
          <Eye className="h-5 w-5 text-muted-foreground" aria-hidden />
          <h2 className="mt-2 text-sm font-semibold">What you see</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            {EMPLOYER_SEES.map((x) => (
              <li key={x} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden />
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div className="panel p-4">
          <EyeOff className="h-5 w-5 text-muted-foreground" aria-hidden />
          <h2 className="mt-2 text-sm font-semibold">What you never see</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            {EMPLOYER_NEVER_SEES.map((x) => (
              <li key={x} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                {x}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Why honest data is the whole point</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          No employer can reliably detect where staff actually are. Compliance data is accurate only
          if employees willingly log their trips. A tool that feels like surveillance gets gamed —
          people stop logging, or log wrong, and the company ends up with data that looks
          authoritative and isn&rsquo;t, which is worse than no data at all. So the employee&rsquo;s
          personal app is the product, and your dashboard is a narrow, employee-visible export from
          it. Every person can see exactly what you see, on their own settings screen, rendered from
          the same query your dashboard runs.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">The compliance side</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              t: "A to-do list, not an archive",
              d: "Each morning: requests waiting, people past a limit, and a dated warning for anyone abroad who will cross one. Every item links to the screen that fixes it.",
            },
            {
              t: "Every number shows its working",
              d: "Open any day count to see the window, each stay that contributed and the days it added. Overlapping or open-ended entries are called out, so the figure survives an audit.",
            },
            {
              t: "Permanent-establishment exposure",
              d: `Per country: how many employees, total days and the longest single stay. Flagged against the ${PE_BENCHMARK_LABEL}. A prompt to take advice, never a legal finding.`,
            },
            {
              t: "Policy limits you set",
              d: "\u201cNo more than 30 days in Germany without approval.\u201d Per country or global, from a template or your own numbers.",
            },
            {
              t: "Travel requests with the maths first",
              d: "The compliance implication is shown before a decision is taken, and approving writes the audit trail.",
            },
            {
              t: "Seats, not surveillance",
              d: "Invite by email, remove at any time. Removing a seat severs the link and never touches the person\u2019s data.",
            },
          ].map((c) => (
            <div key={c.t} className="panel p-4">
              <h3 className="text-sm font-semibold">{c.t}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4" id="pricing">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Pricing</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Per seat, per month, published here. Start a {TRIAL_DAYS}-day trial online, no call.
              Minimum {MINIMUM_SEATS} seats. Annual billing is {ANNUAL_DISCOUNT_PERCENT}% off.
            </p>
          </div>
          <div
            className="inline-flex rounded-full border border-border p-1"
            role="group"
            aria-label="Billing period"
          >
            {([true, false] as const).map((isAnnual) => (
              <button
                key={String(isAnnual)}
                type="button"
                onClick={() => setAnnual(isAnnual)}
                aria-pressed={annual === isAnnual}
                className={
                  annual === isAnnual
                    ? "min-h-9 rounded-full bg-primary px-3.5 text-xs font-medium text-primary-foreground"
                    : "min-h-9 rounded-full px-3.5 text-xs text-muted-foreground hover:text-foreground"
                }
              >
                {isAnnual ? `Annual · save ${ANNUAL_DISCOUNT_PERCENT}%` : "Monthly"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {BUSINESS_TIERS.map((t) => (
            <div
              key={t.id}
              className={
                t.recommended
                  ? "panel flex flex-col space-y-3 border-primary/50 p-5 ring-1 ring-primary/15"
                  : "panel flex flex-col space-y-3 p-5"
              }
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{t.name}</h3>
                {t.recommended ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    Most chosen
                  </span>
                ) : null}
              </div>
              <div>
                <span className="num text-3xl font-semibold">
                  {usd(annual ? annualPerSeatMonthly(t.id) : t.monthlyUsd)}
                </span>
                <span className="text-xs text-muted-foreground"> per seat per month</span>
                {annual ? (
                  <span className="num ms-2 text-sm text-muted-foreground line-through">
                    {usd(t.monthlyUsd)}
                  </span>
                ) : null}
              </div>
              <p className="text-sm font-medium leading-snug">{t.headline}</p>
              <ul className="flex-1 space-y-1.5 text-xs text-muted-foreground">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="num border-t border-border pt-3 text-xs text-muted-foreground">
                {seats} seats:{" "}
                <span className="font-semibold text-foreground">
                  {usd(annual ? annualTotal(seats, t.id) : monthlyTotal(seats, t.id))}
                </span>
                {annual ? " a year" : " a month"}
              </div>
            </div>
          ))}
        </div>

        <div className="panel space-y-2 p-4">
          <label htmlFor="seats" className="label-xs block">
            Team size: <span className="num">{seats}</span> seats
          </label>
          <input
            id="seats"
            type="range"
            min={MINIMUM_SEATS}
            max={250}
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
            className="w-full accent-[hsl(var(--primary))]"
          />
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          What a seat includes for the employee personally rises with the plan: a free account on
          Basic, Starter on Advanced, full Pro on Pro. It stays theirs for personal travel and those
          features are invisible to you. On the roadmap, not sold today:{" "}
          {BUSINESS_ROADMAP.join(", ")}.
        </p>
        <Link
          to="/org"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          Create your organisation and start the trial
        </Link>
      </section>

      <LeadForm />

      <p className="text-[11px] leading-relaxed text-muted-foreground">{LEGAL_DISCLAIMER}</p>
    </div>
  );
}

function LeadForm() {
  const submit = useServerFn(submitB2bLead);
  const joinList = useServerFn(joinWaitlist);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    work_email: "",
    team_size: "",
    message: "",
  });

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await submit({
        data: {
          company_name: form.company_name,
          contact_name: form.contact_name,
          work_email: form.work_email,
          team_size: form.team_size ? Number(form.team_size) : null,
          message: form.message,
        },
      });
      // The lead row is the conversation; the waitlist row is the demand
      // signal. A duplicate here is expected and handled as "already".
      void submitWaitlist(joinList, { email: form.work_email, feature: "b2b" }).catch(() => {});
      setSent(true);
      toast.success("Thanks — we'll be in touch within a working day.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="book-a-call" className="space-y-3 scroll-mt-20">
      <h2 className="text-lg font-semibold tracking-tight">Book a call</h2>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Most teams under 250 people can{" "}
        <Link to="/org" className="underline">
          set up and pay online
        </Link>{" "}
        in a few minutes — no call needed. If you need a custom contract, an invoice instead of a
        card, or more than 250 seats, tell us the shape of the team here and we&rsquo;ll walk
        through what your finance and people teams each need.
      </p>
      {sent ? (
        <div className="panel p-4 text-sm">
          Request received. We&rsquo;ll reply to <span className="num">{form.work_email}</span>.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="panel grid gap-3 p-4 sm:grid-cols-2">
          <Field
            label="Company"
            value={form.company_name}
            onChange={set("company_name")}
            required
          />
          <Field
            label="Your name"
            value={form.contact_name}
            onChange={set("contact_name")}
            required
          />
          <Field
            label="Work email"
            type="email"
            value={form.work_email}
            onChange={set("work_email")}
            required
          />
          <Field
            label="People working abroad"
            type="number"
            value={form.team_size}
            onChange={set("team_size")}
          />
          <label className="sm:col-span-2 space-y-1">
            <span className="label-xs">Anything specific</span>
            <textarea
              rows={3}
              value={form.message}
              onChange={set("message")}
              className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
              placeholder="Countries you're worried about, headcount, timing."
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Sending…" : "Request a call"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="space-y-1">
      <span className="label-xs">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
      />
    </label>
  );
}
