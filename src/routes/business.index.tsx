import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { APP_NAME, LEGAL_DISCLAIMER } from "@/lib/app";
import { submitB2bLead } from "@/lib/org/org.functions";
import { joinWaitlist } from "@/lib/waitlist.functions";
import { submitWaitlist } from "@/lib/waitlist";
import { B2B_PRICING, annualPerSeatMonthly, annualTotal, monthlyTotal, usd } from "@/lib/org/pricing";
import { PE_BENCHMARK_LABEL } from "@/lib/org/presence";

export const Route = createFileRoute("/business/")({
  head: () => ({
    meta: [
      { title: `${APP_NAME} for teams — work-from-anywhere compliance` },
      {
        name: "description",
        content:
          "Give your team the freedom to work from anywhere and the paperwork that makes it safe. Country day-counts for compliance, a full personal account for every employee. $8 per seat per month.",
      },
      { property: "og:title", content: `${APP_NAME} for teams` },
      {
        property: "og:description",
        content:
          "Country day-counts and permanent-establishment exposure for finance. A full personal travel account for every employee.",
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
          Every seat includes a full personal account: visa tracking, tax records, and document
          storage that belongs to your employee, not to you. You see only the country day-counts you
          need for compliance. They see everything else.
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="#book-a-call"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Book a call
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
              t: "Permanent-establishment exposure",
              d: `Per country: how many employees, total days and the longest single stay. Flagged against the ${PE_BENCHMARK_LABEL}.`,
            },
            {
              t: "Policy limits you set",
              d: "\u201cNo more than 30 days in Germany without approval.\u201d Per country or global, with or without an approval gate.",
            },
            {
              t: "Travel requests with the maths first",
              d: "The compliance implication is shown before a decision is taken, and approving writes the audit trail.",
            },
            {
              t: "Country day-counts",
              d: "The same timezone-safe engine behind the personal Schengen tracker, applied to your whole team.",
            },
            {
              t: "Audit export",
              d: "CSV and PDF per country per period, with gaps, missing exit dates and retrospective entries declared.",
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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Pricing</h2>
        <div className="panel space-y-4 p-5">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <div className="num text-3xl font-semibold">
                {usd(B2B_PRICING.perSeatMonthlyUsd)}
              </div>
              <div className="text-xs text-muted-foreground">per seat, per month</div>
            </div>
            <div className="text-xs text-muted-foreground">
              Minimum {B2B_PRICING.minimumSeats} seats · Annual billing{" "}
              {B2B_PRICING.annualDiscountPct}% off ({usd(annualPerSeatMonthly())}/seat/month
              equivalent)
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="seats" className="label-xs block">
              Seats: <span className="num">{seats}</span>
            </label>
            <input
              id="seats"
              type="range"
              min={B2B_PRICING.minimumSeats}
              max={250}
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
              className="w-full accent-[hsl(var(--primary))]"
            />
            <div className="flex flex-wrap gap-6 text-sm">
              <span>
                <span className="num font-semibold">{usd(monthlyTotal(seats))}</span>
                <span className="text-muted-foreground"> / month</span>
              </span>
              <span>
                <span className="num font-semibold">{usd(annualTotal(seats))}</span>
                <span className="text-muted-foreground"> / year billed annually</span>
              </span>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Every seat includes full Pro for that employee, personally: all cities, the arbitrage
            calculator, the Schengen engine, the tax report, the document vault and the radar. It
            stays theirs to use for personal travel, and those features are invisible to you.
          </p>
        </div>
      </section>

      <LeadForm />

      <p className="text-[11px] leading-relaxed text-muted-foreground">{LEGAL_DISCLAIMER}</p>
    </div>
  );
}

function LeadForm() {
  const submit = useServerFn(submitB2bLead);
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
        No self-serve checkout for teams yet — deliberately. Tell us the shape of the team and
        we&rsquo;ll walk through what your finance and people teams each need.
      </p>
      {sent ? (
        <div className="panel p-4 text-sm">
          Request received. We&rsquo;ll reply to{" "}
          <span className="num">{form.work_email}</span>.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="panel grid gap-3 p-4 sm:grid-cols-2">
          <Field label="Company" value={form.company_name} onChange={set("company_name")} required />
          <Field label="Your name" value={form.contact_name} onChange={set("contact_name")} required />
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
