import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Check, Info, ShieldAlert } from "lucide-react";
import { APP_NAME } from "@/lib/app";
import { LegalFooter } from "@/components/LegalFooter";
import { PartnerGroup } from "@/components/partners/PartnerCard";
import { FORMATION_DISCLAIMER } from "@/config/partners";
import {
  ANNUAL_OBLIGATIONS,
  FORM_5472,
  GEORGIA_SMALL_BUSINESS,
  residencyOptions,
} from "@/lib/formation/jurisdictions";
import { evaluate, type FormationAnswers, type Verdict } from "@/lib/formation/eligibility";

export const Route = createFileRoute("/setup/company")({
  head: () => ({
    meta: [
      { title: `Do you actually need a US LLC? — honest check | ${APP_NAME}` },
      {
        name: "description",
        content:
          "A six-question check on whether a US LLC would help you or just cost you. Covers CFC look-through rules, the residency-of-nowhere myth, and the $25,000 Form 5472 penalty.",
      },
      { property: "og:title", content: `Do you actually need a US LLC? | ${APP_NAME}` },
      {
        property: "og:description",
        content:
          "Most nomads are told to form a US LLC. For most of them it changes nothing about their tax bill. Find out which case you are in.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompanySetupPage,
});

const EMPTY: FormationAnswers = {
  citizenship: "",
  taxResidency: "",
  formallyExited: false,
  clients: [],
  revenueBand: "30k_75k",
  usClients: false,
  usPresence: false,
};

const REVENUE_LABELS: Record<FormationAnswers["revenueBand"], string> = {
  under_30k: "Under $30k",
  "30k_75k": "$30k – $75k",
  "75k_150k": "$75k – $150k",
  over_150k: "Over $150k",
};

const CLIENT_LABELS: Record<FormationAnswers["clients"][number], string> = {
  us: "United States",
  eu: "European Union",
  uk: "United Kingdom",
  other: "Elsewhere",
};

function CompanySetupPage() {
  const [answers, setAnswers] = useState<FormationAnswers>(EMPTY);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const countries = residencyOptions();

  const ready = answers.citizenship !== "" && answers.taxResidency !== "";

  function set<K extends keyof FormationAnswers>(key: K, value: FormationAnswers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setVerdict(null);
  }

  function toggleClient(c: FormationAnswers["clients"][number]) {
    setAnswers((prev) => ({
      ...prev,
      clients: prev.clients.includes(c)
        ? prev.clients.filter((x) => x !== c)
        : [...prev.clients, c],
      usClients: c === "us" ? !prev.clients.includes("us") : prev.usClients,
    }));
    setVerdict(null);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-4">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <Link
            to="/kit"
            aria-label="Back to the nomad kit"
            className="-ms-2 grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold tracking-tight">Do you actually need a company?</h1>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The internet will tell you to form a US LLC and pay no tax. For most people with a real
          tax residency that is simply wrong: the company gets looked through and the profit is
          taxed where you live, distribution or not. Six questions, then an honest answer —
          including, quite often, that you should not do this.
        </p>
      </header>

      <section className="space-y-6 rounded-xl border border-border bg-surface p-4">
        <Question label="Your citizenship" hint="Some countries tax you on your passport, not your address.">
          <CountrySelect
            value={answers.citizenship}
            onChange={(v) => set("citizenship", v)}
            countries={countries}
            placeholder="Select citizenship"
          />
        </Question>

        <Question
          label="Current or intended country of tax residency"
          hint="Where you are, or expect to be, tax resident — not where you happen to be this month."
        >
          <CountrySelect
            value={answers.taxResidency}
            onChange={(v) => set("taxResidency", v)}
            countries={countries}
            placeholder="Select country"
            extra={[
              { code: "none", name: "None — I've left and not settled anywhere" },
              { code: "unsure", name: "I'm not sure" },
            ]}
          />
        </Question>

        <Question
          label="Have you formally exited your home country's tax system?"
          hint="Deregistration, a departure return, a P85, or a residency certificate elsewhere. Intending to leave is not leaving."
        >
          <Toggle
            value={answers.formallyExited}
            onChange={(v) => set("formallyExited", v)}
            yes="Yes, formally"
            no="No, or not sure"
          />
        </Question>

        <Question label="Where are your clients?" hint="Select all that apply.">
          <div className="flex flex-wrap gap-2">
            {(["us", "eu", "uk", "other"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleClient(c)}
                aria-pressed={answers.clients.includes(c)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  answers.clients.includes(c)
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {CLIENT_LABELS[c]}
              </button>
            ))}
          </div>
        </Question>

        <Question label="Rough annual revenue" hint="Bands only. We never calculate a saving — that would be advice.">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(REVENUE_LABELS) as FormationAnswers["revenueBand"][]).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => set("revenueBand", b)}
                aria-pressed={answers.revenueBand === b}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  answers.revenueBand === b
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {REVENUE_LABELS[b]}
              </button>
            ))}
          </div>
        </Question>

        <Question
          label="Any US physical presence?"
          hint="Working days spent in the US, staff, an office, or inventory held there."
        >
          <Toggle
            value={answers.usPresence}
            onChange={(v) => set("usPresence", v)}
            yes="Yes"
            no="None"
          />
        </Question>

        <button
          type="button"
          disabled={!ready}
          onClick={() => setVerdict(evaluate(answers))}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
        >
          Show me the honest answer
        </button>
        <p className="text-xs text-muted-foreground">
          Answers stay in your browser. Nothing is sent anywhere.
        </p>
      </section>

      {verdict ? <VerdictPanel verdict={verdict} /> : null}

      <LegalFooter />
    </div>
  );
}

function Question({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      {children}
    </div>
  );
}

function CountrySelect({
  value,
  onChange,
  countries,
  placeholder,
  extra = [],
}: {
  value: string;
  onChange: (v: string) => void;
  countries: { code: string; name: string }[];
  placeholder: string;
  extra?: { code: string; name: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm text-foreground"
    >
      <option value="">{placeholder}</option>
      {extra.map((o) => (
        <option key={o.code} value={o.code}>
          {o.name}
        </option>
      ))}
      {countries.map((c) => (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  value,
  onChange,
  yes,
  no,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  yes: string;
  no: string;
}) {
  return (
    <div className="flex gap-2">
      {[
        { v: true, label: yes },
        { v: false, label: no },
      ].map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
            value === o.v
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The verdict.
 *
 * Company formation is the highest-paying affiliate in this app — up to $1,500
 * a referral — which is exactly why the partner block below is gated on
 * `verdict.showPartners` and nothing else. On the CFC outcome, which is the
 * most common real-world answer, we show no link at all: an LLC is unlikely to
 * reduce that person's tax bill, and taking a commission for sending them into
 * an annual Form 5472 obligation with a $25,000 penalty would be indefensible.
 * See DISQUALIFYING_OUTCOMES and the FORMATION RULE in src/config/partners.ts.
 *
 * Do not add a "but if you still want to" link on a disqualifying outcome.
 * That is the same thing with extra steps.
 */
function VerdictPanel({ verdict }: { verdict: Verdict }) {
  const positive = verdict.showPartners;
  return (
    <section className="space-y-6">
      <div
        className={`rounded-xl border p-4 ${
          positive
            ? "border-accent-positive/30 bg-accent-positive-muted"
            : "border-accent-warning/30 bg-accent-warning-muted"
        }`}
      >
        <div className="flex items-start gap-3">
          {positive ? (
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent-positive" aria-hidden />
          ) : (
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-accent-warning" aria-hidden />
          )}
          <div className="space-y-2">
            <h2 className="text-base font-bold leading-tight tracking-tight text-foreground">
              {verdict.headline}
            </h2>
            <p className="text-sm leading-relaxed text-foreground/90">{verdict.summary}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="label-xs font-semibold">Why</h3>
        <ul className="space-y-2">
          {verdict.reasons.map((r) => (
            <li key={r} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
              <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      {verdict.sections.map((s) => (
        <div key={s.heading} className="space-y-1 rounded-xl border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold text-foreground">{s.heading}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
        </div>
      ))}

      {/* Shown on every outcome where a company is even on the table. */}
      {verdict.showObligations ? <ObligationsBlock /> : null}

      {verdict.showGeorgiaAlternative ? <GeorgiaBlock /> : null}

      {verdict.showPartners ? (
        <div className="space-y-3">
          <PartnerGroup
            category="formation"
            placement="company_tool"
            title="Formation services"
            variant="row"
          />
          <p className="text-xs leading-relaxed text-muted-foreground">{FORMATION_DISCLAIMER}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold text-foreground">
            We&apos;re not showing you a formation link
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {verdict.noPartnersReason}
          </p>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-border bg-surface-2 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">
            Why we might tell you not to do this.
          </span>{" "}
          Company formation is the highest-paying referral we could carry — up to $1,500 a sign-up.
          That is precisely why this tool decides the answer before it decides whether to show a
          link, and why the most common outcome carries none.{" "}
          <Link to="/how-we-make-money" className="underline hover:text-foreground">
            How we make money
          </Link>
          .
        </p>
      </div>

      <p className="text-sm font-medium leading-relaxed text-foreground">{verdict.adviserLine}</p>
    </section>
  );
}

/** The annual bill, on every outcome where an LLC is on the table at all. */
function ObligationsBlock() {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3 rounded-lg border border-accent-warning/30 bg-accent-warning-muted p-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent-warning" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-foreground">
            {FORM_5472.title} — penalty {FORM_5472.penaltyLabel}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-foreground/90">
            {FORM_5472.who} {FORM_5472.detail}
          </p>
        </div>
      </div>
      <h3 className="text-sm font-semibold text-foreground">
        What it costs every year, not just to set up
      </h3>
      <p className="text-xs leading-relaxed text-muted-foreground">
        The $399 headline is the one-off. These repeat for as long as the company exists, and
        closing an unused company is itself a filing.
      </p>
      <ul className="divide-y divide-border">
        {ANNUAL_OBLIGATIONS.map((o) => (
          <li key={o.label} className="py-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-foreground">{o.label}</span>
              <span className="font-mono text-xs text-muted-foreground">{o.cost}</span>
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{o.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Not an affiliate product. That is rather the point of including it. */
function GeorgiaBlock() {
  return (
    <div className="space-y-2 rounded-xl border border-accent-positive/30 bg-accent-positive-muted p-4">
      <h3 className="text-sm font-semibold text-foreground">
        {GEORGIA_SMALL_BUSINESS.name} — {GEORGIA_SMALL_BUSINESS.rate}
      </h3>
      <p className="text-sm leading-relaxed text-foreground/90">
        Up to {GEORGIA_SMALL_BUSINESS.ceiling}. {GEORGIA_SMALL_BUSINESS.detail}
      </p>
      <p className="text-sm leading-relaxed text-foreground/90">{GEORGIA_SMALL_BUSINESS.caution}</p>
      <p className="text-xs text-muted-foreground">
        We earn nothing from this. It is here because for most freelancers it is the simpler
        answer.{" "}
        <Link
          to="/city/$cityId"
          params={{ cityId: "tbilisi-ge" }}
          className="underline hover:text-foreground"
        >
          Tbilisi in the city data
        </Link>
        .
      </p>
    </div>
  );
}
