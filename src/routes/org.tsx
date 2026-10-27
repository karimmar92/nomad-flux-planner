import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Download,
  Globe,
  LayoutDashboard,
  Loader2,
  Settings2,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { APP_NAME, LEGAL_DISCLAIMER } from "@/lib/app";
import { Stat } from "@/components/Primitives";
import { RequiresNetwork } from "@/components/OfflineBanner";
import { CreateOrgFlow } from "@/components/org/CreateOrgFlow";
import { DashboardShell, type NavItem } from "@/components/org/DashboardShell";
import { CheckoutDialog, type CheckoutRequest } from "@/components/billing/CheckoutDialog";
import { paymentsAvailable, getStripeEnvironment } from "@/lib/stripe";
import {
  confirmCheckout,
  createPortalSession,
  verifyCheckoutSession,
} from "@/lib/billing/billing.functions";
import { useProfile } from "@/lib/store";
import { useSession } from "@/lib/use-session";
import {
  decideTravelRequest,
  deletePolicy,
  getEmployerDashboard,
  inviteSeat,
  removeSeat,
  upsertPolicy,
} from "@/lib/org/org.functions";
import {
  buildOrgOverview,
  requestImpact,
  PE_BENCHMARK_DAYS,
  PE_BENCHMARK_LABEL,
  type RiskLevel,
} from "@/lib/org/presence";
import { auditFileName, auditToCsv, auditToPdf, AUDIT_DISCLAIMER } from "@/lib/org/export";
import { usd } from "@/lib/org/pricing";
import {
  businessTier,
  clampSeats,
  EVALUATION_SEATS,
  normaliseOrgPlan,
  orgHasFeature,
  tierUnlocking,
  type OrgFeature,
  type OrgPlan,
} from "@/config/business-plans";
import { PlanPicker, type PlanChoice } from "@/components/org/PlanPicker";
import { TRIAL_DAYS } from "@/config/pricing";
import { buildActionItems, type ActionItem } from "@/lib/org/actions";
import { explainCount } from "@/lib/org/explain";
import { recordConfidence, type ConfidenceLevel, type OrgConfidence } from "@/lib/org/confidence";
import { buildVerdict, type Verdict, type VerdictLevel } from "@/lib/org/verdict";
import {
  DEFAULT_LENS,
  LENSES,
  isLens,
  lensLayout,
  type Lens,
  type SectionId,
} from "@/lib/org/lens";
import { sampleDashboard } from "@/lib/org/sample";
import { workRightsFor } from "@/config/work-rights-data";
import { STATUS_LABEL } from "@/lib/work-rights";
import { downloadBlob } from "@/lib/reports/export-csv";
import { todayIso } from "@/lib/trip-dates";
import { formatDate } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

type OrgSearch = { checkout?: "success"; session_id?: string };

export const Route = createFileRoute("/org")({
  validateSearch: (search: Record<string, unknown>): OrgSearch => ({
    ...(search["checkout"] === "success" ? { checkout: "success" as const } : {}),
    ...(typeof search["session_id"] === "string" ? { session_id: search["session_id"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: `Team compliance | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Country day-counts, permanent-establishment exposure, policy limits and travel approvals for your team — country and dates only, nothing personal.",
      },
      { property: "og:title", content: `Team compliance | ${APP_NAME}` },
      {
        property: "og:description",
        content: "Risk overview, per-country exposure, travel requests and audit export.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrgDashboard,
});

const TABS = ["Risk", "Countries", "Employees", "Requests", "Seats"] as const;
type Tab = (typeof TABS)[number];

/** Where each tab appears in the sidebar and what its page header says. */
const NAV_COPY: Record<Tab, Pick<NavItem<Tab>, "label" | "icon" | "title" | "description">> = {
  Risk: {
    label: "Overview",
    icon: LayoutDashboard,
    title: "Overview",
    description: "One verdict on where your team stands, then what needs a decision today.",
  },
  Countries: {
    label: "Countries",
    icon: Globe,
    title: "Countries",
    description:
      "Days per person in each country against its limit. Open any number to see the working.",
  },
  Employees: {
    label: "People",
    icon: Users,
    title: "People",
    description: "Everyone on the team, what they have logged, and anything that needs a word.",
  },
  Requests: {
    label: "Requests",
    icon: ClipboardCheck,
    title: "Travel requests",
    description: "Each request shows the days it would use before you approve or decline.",
  },
  Seats: {
    label: "Team & plan",
    icon: Settings2,
    title: "Team and plan",
    description: "Invite people, set company limits, and manage your plan and billing.",
  },
};

const riskTone: Record<RiskLevel, string> = {
  over: "text-negative",
  approaching: "text-warning",
  clear: "text-positive",
};

function RiskPill({ risk }: { risk: RiskLevel }) {
  return (
    <span
      className={cn(
        "rounded-full border border-border px-2 py-0.5 text-[11px] capitalize",
        riskTone[risk],
      )}
    >
      {risk}
    </span>
  );
}

/**
 * Confirms a Teams checkout on return from Stripe, scoped to this dashboard.
 *
 * Mirrors CheckoutReturn (src/components/billing/CheckoutReturn.tsx) rather
 * than reusing it: that component's CTAs ("open the comparison", "go to the
 * tracker") are written for the personal upgrade flow, and would be actively
 * wrong here — the next thing an admin who just paid wants is to invite
 * their team, not browse cities.
 */
function TeamsCheckoutBanner({ sessionId, onDone }: { sessionId: string; onDone: () => void }) {
  const verify = useServerFn(verifyCheckoutSession);
  const confirm = useServerFn(confirmCheckout);
  const { patchProfile } = useProfile();
  const [state, setState] = useState<"working" | "granted" | "pending" | "failed">("working");
  const [message, setMessage] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      try {
        // Records the purchased tier on the organisation before the dashboard
        // refreshes, so the plan the buyer just paid for is the one it shows.
        // Idempotent with the webhook; a failure here is not fatal.
        await confirm({ data: { environment: getStripeEnvironment(), sessionId } }).catch(
          () => undefined,
        );
        const result = await verify({ data: { sessionId, environment: getStripeEnvironment() } });
        if ("error" in result) {
          setState(result.pending ? "pending" : "failed");
          setMessage(result.error);
          return;
        }
        patchProfile({ plan: result.plan as never });
        setState("granted");
        onDone();
      } catch (e) {
        setState("failed");
        setMessage(e instanceof Error ? e.message : "Could not reach the payment service.");
      }
    })();
    // onDone/patchProfile/verify are stable enough for a run-once effect keyed on sessionId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (state === "working") {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-2 p-4 text-sm">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        Checking your payment with Stripe…
      </div>
    );
  }
  if (state === "granted") {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-accent-positive/40 bg-accent-positive-muted p-4 text-sm">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-accent-positive" aria-hidden />
        Payment received — your Teams subscription is active. Invite your people on the Seats tab.
      </div>
    );
  }
  if (state === "pending") {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-2 p-4 text-sm">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        Your payment is still settling — {message} Access opens automatically.
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-negative/40 bg-negative-muted p-4 text-sm">
      <XCircle className="h-4 w-4 shrink-0 text-negative" aria-hidden />
      We could not confirm that payment. {message}
    </div>
  );
}

function OrgDashboard() {
  const { signedIn, ready } = useSession();
  const [tab, setTab] = useState<Tab>("Risk");
  const fetchDashboard = useServerFn(getEmployerDashboard);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { checkout, session_id: sessionId } = Route.useSearch();

  const { data, isLoading } = useQuery({
    queryKey: ["employer-dashboard"],
    queryFn: () => fetchDashboard({}),
    enabled: signedIn,
  });

  const clearCheckoutParams = () =>
    void navigate({
      to: "/org",
      search: (prev: Record<string, unknown>) => {
        const { checkout: _c, session_id: _s, ...rest } = prev;
        return rest as OrgSearch;
      },
      replace: true,
    });

  const [sample, setSample] = useState(false);
  const [lens, setLens] = useState<Lens>(DEFAULT_LENS);

  // The chosen lens is remembered per browser. Read after mount so the server
  // and first client render agree.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("driftly.org-lens");
      if (isLens(saved)) setLens(saved);
    } catch {
      // Storage blocked: the default lens is fine.
    }
  }, []);
  const chooseLens = (next: Lens) => {
    setLens(next);
    try {
      window.localStorage.setItem("driftly.org-lens", next);
    } catch {
      // Not remembering is harmless.
    }
  };

  // Sample data replaces what is READ, never what is written, and only the
  // read-only tabs use it. Seats and billing always show the real organisation.
  const view = useMemo(
    () => (data && sample ? { ...data, ...sampleDashboard(todayIso()) } : data),
    [data, sample],
  );

  const overview = useMemo(
    () => (view ? buildOrgOverview(view.rows, view.members, view.policies, todayIso()) : null),
    [view],
  );

  const orgPlan = normaliseOrgPlan(data?.org?.plan);
  const actions = useMemo(
    () =>
      view && overview && orgHasFeature(orgPlan, "actionCenter")
        ? buildActionItems(overview, view.rows, view.requests, todayIso(), {
            forecast: orgHasFeature(orgPlan, "forecast"),
            workRights: workRightsFor,
          })
        : [],
    [view, overview, orgPlan],
  );
  const confidence = useMemo(
    () => (view ? recordConfidence(view.rows, view.members, todayIso()) : null),
    [view],
  );
  const verdict = useMemo(
    () =>
      overview && confidence
        ? buildVerdict(overview, actions, confidence, orgHasFeature(orgPlan, "forecast"))
        : null,
    [overview, confidence, actions, orgPlan],
  );

  if (!ready) return null;
  if (!signedIn) {
    return (
      <div className="panel p-5 text-sm">
        <Link to="/auth" search={{ next: "/org" }} className="underline">
          Sign in
        </Link>{" "}
        with an admin account to open your team dashboard.
      </div>
    );
  }
  if (isLoading) {
    return (
      <RequiresNetwork reason="Team compliance figures are read server-side from the restricted employer view.">
        <div />
      </RequiresNetwork>
    );
  }
  if (!data?.isAdmin || !data.org || !view || !overview || !confidence || !verdict) {
    return (
      <div className="max-w-lg space-y-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Team compliance</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            If you were given a seat, everything shared with your employer is listed on{" "}
            <Link to="/settings/employer-sharing" className="underline">
              your sharing screen
            </Link>
            . Setting this up for your company — start below, no sales call required, or{" "}
            <Link to="/business" className="underline">
              read about the team plan
            </Link>{" "}
            first.
          </p>
        </div>
        <CreateOrgFlow
          onFinished={() => qc.invalidateQueries({ queryKey: ["employer-dashboard"] })}
        />
      </div>
    );
  }

  const org = data.org;
  const activeSeats = data.members.filter((m) => m.status === "active").length;
  const invited = data.members.filter((m) => m.status === "invited").length;
  const refresh = () => qc.invalidateQueries({ queryKey: ["employer-dashboard"] });

  const pendingRequests = view.requests.filter((r) => r.status === "pending").length;
  const urgentActions = actions.filter((a) => a.severity === "urgent").length;
  const navItems: NavItem<Tab>[] = TABS.map((id) => ({
    id,
    ...NAV_COPY[id],
    badge:
      id === "Risk"
        ? urgentActions || undefined
        : id === "Requests"
          ? pendingRequests || undefined
          : undefined,
    badgeTone: id === "Risk" ? "alert" : "info",
  }));

  async function quickExport() {
    downloadBlob(
      new Blob([auditToCsv(overview!, org.name, null)], { type: "text/csv;charset=utf-8" }),
      auditFileName(org.name, "csv"),
    );
  }

  const quickActions = (
    <>
      <button
        type="button"
        onClick={() => setTab("Seats")}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-xs font-medium text-background transition-opacity hover:opacity-90"
      >
        <UserPlus className="h-3.5 w-3.5" aria-hidden /> Invite people
      </button>
      <button
        type="button"
        onClick={() => void quickExport()}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3.5 text-xs font-medium transition-colors hover:bg-surface-2"
      >
        <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
      </button>
    </>
  );

  const banner = (
    <>
      {checkout === "success" && sessionId ? (
        <TeamsCheckoutBanner
          sessionId={sessionId}
          onDone={() => {
            refresh();
            clearCheckoutParams();
          }}
        />
      ) : null}
      {sample ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-surface-2 p-3 text-sm"
        >
          <span>
            <span className="font-medium">Sample data.</span> These people are made up and nothing
            here is saved. Seats and billing show your real organisation.
          </span>
          <button
            type="button"
            onClick={() => setSample(false)}
            className="rounded-md border border-border px-3 py-1 text-xs hover:bg-surface-2"
          >
            Exit sample
          </button>
        </div>
      ) : null}
    </>
  );

  return (
    <DashboardShell
      orgName={org.name}
      items={navItems}
      current={tab}
      onNavigate={setTab}
      actions={quickActions}
      banner={banner}
    >
      {tab === "Risk" ? (
        <RiskTab
          plan={orgPlan}
          actions={actions}
          verdict={verdict}
          confidence={confidence}
          lens={lens}
          onLens={chooseLens}
          onJump={setTab}
          {...(sample ? {} : { onSample: () => setSample(true) })}
          overview={overview}
          orgName={org.name}
          seats={{ activeSeats, invited, purchased: org.seats_purchased }}
        />
      ) : null}
      {tab === "Countries" ? (
        <CountriesTab plan={orgPlan} overview={overview} rows={view.rows} />
      ) : null}
      {tab === "Employees" ? <EmployeesTab overview={overview} /> : null}
      {tab === "Requests" ? (
        sample ? (
          <div className="panel p-4 text-sm text-muted-foreground">
            Sample data is read-only. With real data, each request shows its headroom and a
            compliant end date before you decide.
          </div>
        ) : orgHasFeature(orgPlan, "approvals") ? (
          <RequestsTab data={data} overview={overview} onChange={refresh} />
        ) : (
          <Locked
            feature="approvals"
            what="Travel requests with the compliance maths shown before you decide"
            onJump={() => setTab("Seats")}
          />
        )
      ) : null}
      {tab === "Seats" ? <SeatsTab data={data} plan={orgPlan} onChange={refresh} /> : null}

      <p className="text-[11px] leading-relaxed text-muted-foreground">{LEGAL_DISCLAIMER}</p>
    </DashboardShell>
  );
}

type Dashboard = NonNullable<Awaited<ReturnType<typeof getEmployerDashboard>>>;
type Overview = NonNullable<ReturnType<typeof buildOrgOverview>>;

const SEVERITY_DOT: Record<ActionItem["severity"], string> = {
  urgent: "bg-negative",
  soon: "bg-warning",
  housekeeping: "bg-muted-foreground/50",
};

/**
 * The first thing an admin sees: what to do today, ranked, each with a way
 * straight to the screen that resolves it. An archive tells you where people
 * were; this tells you what needs a decision before it becomes a problem.
 */
function ActionCenter({
  items,
  onJump,
  limit = 5,
}: {
  items: ActionItem[];
  onJump: (tab: Tab) => void;
  limit?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? items : items.slice(0, limit);
  const urgent = items.filter((i) => i.severity === "urgent").length;

  return (
    <section className="space-y-2" aria-labelledby="needs-attention">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="needs-attention" className="text-sm font-semibold">
          Needs attention
          {items.length > 0 ? (
            <span className="num ms-2 text-xs font-normal text-muted-foreground">
              {urgent > 0 ? `${urgent} urgent · ` : ""}
              {items.length} total
            </span>
          ) : null}
        </h2>
      </div>
      {items.length === 0 ? (
        <div className="panel p-4 text-sm text-muted-foreground">
          Nothing needs a decision right now. No one is over a limit, no stay is projected to cross
          one in the next 30 days, and no requests are waiting.
        </div>
      ) : (
        <ul className="panel divide-y divide-border p-0">
          {shown.map((item) => (
            <li key={item.id} className="flex items-start gap-3 p-3.5">
              <span
                className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", SEVERITY_DOT[item.severity])}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{item.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {item.detail}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onJump(item.tab)}
                className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs transition-colors hover:bg-surface-2"
              >
                {item.tab}
              </button>
            </li>
          ))}
        </ul>
      )}
      {items.length > limit ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {showAll ? "Show fewer" : `Show all ${items.length}`}
        </button>
      ) : null}
    </section>
  );
}

/** What a plan does not include, said plainly, with the cheapest plan that does. */
function Locked({
  feature,
  what,
  onJump,
}: {
  feature: OrgFeature;
  what: string;
  onJump?: () => void;
}) {
  const t = tierUnlocking(feature);
  return (
    <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{what}</p>
        <p className="text-xs text-muted-foreground">
          Included in {t.name} and above, from {usd(t.yearlyUsd)} per seat per year.
        </p>
      </div>
      {onJump ? (
        <button
          type="button"
          onClick={onJump}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-surface-2"
        >
          See plans
        </button>
      ) : null}
    </div>
  );
}

const VERDICT_TONE: Record<VerdictLevel, { dot: string; ring: string; label: string }> = {
  act: { dot: "bg-negative", ring: "border-negative/40", label: "Act" },
  watch: { dot: "bg-warning", ring: "border-warning/40", label: "Watch" },
  clear: { dot: "bg-accent-positive", ring: "border-accent-positive/40", label: "Clear" },
  empty: { dot: "bg-muted-foreground/50", ring: "border-border", label: "No data yet" },
};

const CONFIDENCE_BAR: Record<ConfidenceLevel, string> = {
  high: "bg-accent-positive",
  medium: "bg-warning",
  low: "bg-negative",
  none: "bg-muted-foreground/40",
};

/**
 * One answer before any table. The level comes from the overview, so a plan
 * without the action list still says "act" when someone is past a limit; and
 * "clear" is withheld when too few records exist to justify it.
 */
function VerdictCard({
  verdict,
  confidence,
  onJump,
  onSample,
}: {
  verdict: Verdict;
  confidence: OrgConfidence;
  onJump: (tab: Tab) => void;
  onSample?: (() => void) | undefined;
}) {
  const tone = VERDICT_TONE[verdict.level];
  const quality = confidence.quality;
  return (
    <section
      className={cn("panel grid gap-5 p-5 sm:grid-cols-[1fr_15rem]", tone.ring)}
      aria-label="Overall verdict"
    >
      <div className="min-w-0 space-y-2">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span className={cn("h-2 w-2 rounded-full", tone.dot)} aria-hidden />
          {tone.label}
        </p>
        <h2 className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
          {verdict.headline}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{verdict.detail}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {verdict.topAction ? (
            <button
              type="button"
              onClick={() => onJump(verdict.topAction!.tab)}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Open {verdict.topAction.tab}
            </button>
          ) : null}
          {verdict.level === "empty" && onSample ? (
            <button
              type="button"
              onClick={onSample}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Preview with sample data
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-2 border-border sm:border-s sm:ps-5">
        <p className="label-xs">Record confidence</p>
        <p className="num text-2xl font-semibold">{quality === null ? "n/a" : `${quality}%`}</p>
        <div
          role="meter"
          aria-label="Record confidence"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={quality ?? 0}
          className="h-1.5 overflow-hidden rounded-full bg-surface-2"
        >
          <div
            className={cn("h-full rounded-full", CONFIDENCE_BAR[confidence.level])}
            style={{ width: `${quality ?? 0}%` }}
          />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {confidence.coverage}% of seats have logged travel. How far the numbers can be leaned on,
          from how complete and recent each record is.
        </p>
      </div>
    </section>
  );
}

function LensSwitch({ lens, onChange }: { lens: Lens; onChange: (l: Lens) => void }) {
  const active = LENSES.find((l) => l.id === lens);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <div
        role="group"
        aria-label="View as"
        className="inline-flex rounded-full border border-border p-0.5"
      >
        {LENSES.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => onChange(l.id)}
            aria-pressed={lens === l.id}
            className={
              lens === l.id
                ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                : "rounded-full px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
            }
          >
            {l.label}
          </button>
        ))}
      </div>
      <span className="text-xs text-muted-foreground">{active?.blurb}</span>
    </div>
  );
}

const LEVEL_LABEL: Record<ConfidenceLevel, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "No record",
};

function PeopleSection({
  overview,
  confidence,
}: {
  overview: Overview;
  confidence: OrgConfidence;
}) {
  const byId = new Map(confidence.members.map((m) => [m.user_id, m]));
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Everyone</h2>
      {overview.members.length === 0 ? (
        <div className="panel p-4 text-sm text-muted-foreground">No active seats yet.</div>
      ) : (
        <div className="panel overflow-x-auto p-4">
          <table className="w-full text-start text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-1.5 pe-4 font-medium">Person</th>
                <th className="py-1.5 pe-4 font-medium">Status</th>
                <th className="py-1.5 pe-4 font-medium">Most days</th>
                <th className="py-1.5 font-medium">Record</th>
              </tr>
            </thead>
            <tbody>
              {overview.members.map((m) => {
                const c = byId.get(m.user_id);
                return (
                  <tr key={m.user_id} className="border-b border-border/60 align-top">
                    <td className="py-1.5 pe-4">{m.display_name}</td>
                    <td className="py-1.5 pe-4">
                      {/* No record is not the same as clear: say it. */}
                      {c?.level === "none" ? (
                        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                          No data
                        </span>
                      ) : (
                        <RiskPill risk={m.risk} />
                      )}
                    </td>
                    <td className="num py-1.5 pe-4">
                      {m.peCountry ? `${m.peCountry} · ${m.peDaysMax}` : "None"}
                    </td>
                    <td className="py-1.5 text-xs">
                      {c ? (
                        <>
                          <span className="font-medium">{LEVEL_LABEL[c.level]}</span>
                          {c.level !== "none" ? (
                            <span className="num text-muted-foreground"> · {c.score}</span>
                          ) : null}
                          {c.reasons.length > 0 ? (
                            <span className="block text-muted-foreground">
                              {c.reasons.join("; ")}
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RiskTab({
  plan,
  actions,
  verdict,
  confidence,
  lens,
  onLens,
  onJump,
  onSample,
  overview,
  orgName,
  seats,
}: {
  plan: OrgPlan;
  actions: ActionItem[];
  verdict: Verdict;
  confidence: OrgConfidence;
  lens: Lens;
  onLens: (l: Lens) => void;
  onJump: (tab: Tab) => void;
  onSample?: (() => void) | undefined;
  overview: Overview;
  orgName: string;
  seats: { activeSeats: number; invited: number; purchased: number };
}) {
  const [country, setCountry] = useState<string>("");
  const filter = country || null;
  const layout = lensLayout(lens);

  async function exportCsv() {
    downloadBlob(
      new Blob([auditToCsv(overview, orgName, filter)], { type: "text/csv;charset=utf-8" }),
      auditFileName(orgName, "csv"),
    );
  }
  async function exportPdf() {
    downloadBlob(await auditToPdf(overview, orgName, filter), auditFileName(orgName, "pdf"));
  }

  const sections: Record<SectionId, React.ReactNode> = {
    actions: orgHasFeature(plan, "actionCenter") ? (
      <ActionCenter items={actions} onJump={onJump} limit={layout.actionLimit ?? 5} />
    ) : (
      <Locked
        feature="actionCenter"
        what="A ranked daily to-do list for your compliance team"
        onJump={() => onJump("Seats")}
      />
    ),

    people: <PeopleSection overview={overview} confidence={confidence} />,

    exposure: orgHasFeature(plan, "peExposure") ? (
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Permanent-establishment exposure</h2>
        <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
          {PE_BENCHMARK_LABEL}. Anyone at or approaching {PE_BENCHMARK_DAYS} recorded days in a
          single country over the rolling 12 months is flagged below. This records presence; it is
          not a determination that a permanent establishment exists.
        </p>
        {overview.countries.length === 0 ? (
          <div className="panel p-4 text-sm text-muted-foreground">
            No travel recorded in the last 12 months.
          </div>
        ) : (
          <div className="panel overflow-x-auto p-4">
            <table className="w-full text-start text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-1.5 pe-4 font-medium">Country</th>
                  <th className="py-1.5 pe-4 font-medium">Employees</th>
                  <th className="py-1.5 pe-4 font-medium">Total days</th>
                  <th className="py-1.5 pe-4 font-medium">Longest stay</th>
                  <th className="py-1.5 pe-4 font-medium">Threshold</th>
                  <th className="py-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {overview.countries.map((c) => (
                  <tr key={c.country_code} className="border-b border-border/60">
                    <td className="py-1.5 pe-4">
                      {c.country}
                      {c.peExceeded ? (
                        <span className="ms-2 text-[11px] text-negative">PE benchmark passed</span>
                      ) : c.peApproaching ? (
                        <span className="ms-2 text-[11px] text-warning">
                          approaching PE benchmark
                        </span>
                      ) : null}
                    </td>
                    <td className="num py-1.5 pe-4">{c.employeeCount}</td>
                    <td className="num py-1.5 pe-4">{c.totalDays}</td>
                    <td className="num py-1.5 pe-4">{c.longestSingleStay}</td>
                    <td className="num py-1.5 pe-4">
                      {c.thresholdDays}
                      {c.policyMaxDays !== null ? ` · policy ${c.policyMaxDays}` : ""}
                    </td>
                    <td className="py-1.5">
                      <RiskPill risk={c.risk} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    ) : (
      <Locked
        feature="peExposure"
        what="Permanent-establishment exposure by country"
        onJump={() => onJump("Seats")}
      />
    ),

    quality: (
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">How far to trust the numbers</h2>
        <p className="text-xs text-muted-foreground">{AUDIT_DISCLAIMER}</p>
        <div className="panel space-y-1.5 p-4 text-sm">
          {confidence.members.every((m) => m.reasons.length === 0) &&
          overview.flags.length === 0 ? (
            <p className="text-muted-foreground">
              Nothing to fix. Every record is complete and recent.
            </p>
          ) : (
            <>
              {[...confidence.members]
                .filter((m) => m.reasons.length > 0)
                .sort((a, b) => a.score - b.score)
                .map((m) => (
                  <div key={m.user_id}>
                    <span className="font-medium">{m.display_name}</span>{" "}
                    <span className="text-muted-foreground">{m.reasons.join("; ")}.</span>
                  </div>
                ))}
              {overview.flags
                .filter((f) => f.kind === "retrospective")
                .slice(0, 10)
                .map((f, i) => (
                  <div key={`${f.kind}-${i}`}>
                    <span className="font-medium">{f.label}</span>{" "}
                    <span className="text-muted-foreground">{f.detail}</span>
                  </div>
                ))}
            </>
          )}
        </div>
      </section>
    ),

    exports: (
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Audit export</h2>
        <div className="panel flex flex-wrap items-end gap-3 p-4">
          <label className="space-y-1">
            <span className="label-xs">Country</span>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
            >
              <option value="">All countries</option>
              {overview.countries.map((c) => (
                <option key={c.country_code} value={c.country_code}>
                  {c.country}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void exportCsv()}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-surface-2"
          >
            <Download className="h-4 w-4" aria-hidden /> CSV
          </button>
          {orgHasFeature(plan, "pdfExport") ? (
            <button
              type="button"
              onClick={() => void exportPdf()}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-surface-2"
            >
              <Download className="h-4 w-4" aria-hidden /> PDF
            </button>
          ) : null}
          <span className="text-xs text-muted-foreground">
            Period {overview.windowStart} → {overview.windowEnd}
          </span>
        </div>
      </section>
    ),
  };

  return (
    <div className="space-y-5">
      <VerdictCard verdict={verdict} confidence={confidence} onJump={onJump} onSample={onSample} />
      <LensSwitch lens={lens} onChange={onLens} />

      {lens !== "founder" ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(
            [
              {
                label: "Over a limit",
                value: overview.counts.over,
                tone: "text-negative",
                dot: "bg-negative",
                go: "Countries",
              },
              {
                label: "Approaching",
                value: overview.counts.approaching,
                tone: "text-warning",
                dot: "bg-warning",
                go: "Countries",
              },
              {
                label: "Clear",
                value: overview.counts.clear,
                tone: "text-positive",
                dot: "bg-accent-positive",
                go: "Employees",
              },
              {
                label: "Seats in use",
                value: `${seats.activeSeats}/${seats.purchased}`,
                tone: "text-foreground",
                dot: "bg-muted-foreground/50",
                go: "Seats",
              },
            ] as const
          ).map((k) => (
            <button
              key={k.label}
              type="button"
              onClick={() => onJump(k.go)}
              className="panel group p-4 text-start transition-colors hover:border-primary"
            >
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("h-1.5 w-1.5 rounded-full", k.dot)} aria-hidden />
                {k.label}
              </p>
              <p className={cn("num mt-1 text-2xl font-semibold", k.tone)}>{k.value}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {k.label === "Seats in use" && seats.invited > 0
                  ? `${seats.invited} invited`
                  : overview.counts.noData > 0 && k.label === "Clear"
                    ? `${overview.counts.noData} with no data`
                    : "\u00a0"}
              </p>
            </button>
          ))}
        </div>
      ) : null}

      {layout.sections.map((id) => (
        <Fragment key={id}>{sections[id]}</Fragment>
      ))}
    </div>
  );
}

function CountriesTab({
  plan,
  overview,
  rows,
}: {
  plan: OrgPlan;
  overview: Overview;
  rows: Dashboard["rows"];
}) {
  const canExplain = orgHasFeature(plan, "explain");
  const [open, setOpen] = useState<string | null>(null);
  const [code, setCode] = useState(overview.countries[0]?.country_code ?? "");
  const country = overview.countries.find((c) => c.country_code === code);

  if (overview.countries.length === 0) {
    return <div className="panel p-4 text-sm text-muted-foreground">No travel recorded yet.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {overview.countries.map((c) => (
          <button
            type="button"
            key={c.country_code}
            onClick={() => setCode(c.country_code)}
            className={cn(
              "rounded-md border border-border px-2.5 py-1 text-xs transition-colors",
              c.country_code === code ? "bg-surface-2" : "hover:bg-surface-2",
            )}
          >
            {c.country}
          </button>
        ))}
      </div>
      {country ? (
        <div className="panel space-y-3 p-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Employees" value={country.employeeCount} size="sm" />
            <Stat label="Total days" value={country.totalDays} size="sm" />
            <Stat label="Longest stay" value={country.longestSingleStay} size="sm" />
            <Stat
              label="Limits"
              value={`${country.thresholdDays}${country.policyMaxDays !== null ? ` / ${country.policyMaxDays}` : ""}`}
              hint={country.policyMaxDays !== null ? "residency / policy" : "residency threshold"}
              size="sm"
            />
          </div>
          <table className="w-full text-start text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-1.5 pe-4 font-medium">Employee</th>
                <th className="py-1.5 pe-4 font-medium">Days</th>
                <th className="py-1.5 pe-4 font-medium">Longest</th>
                <th className="py-1.5 pe-4 font-medium">Status</th>
                <th className="py-1.5" />
              </tr>
            </thead>
            <tbody>
              {country.members.map((m) => {
                const isOpen = open === m.user_id;
                const why = isOpen
                  ? explainCount(rows, m.user_id, country.country_code, overview.windowEnd)
                  : null;
                return (
                  <Fragment key={m.user_id}>
                    <tr className="border-b border-border/60">
                      <td className="py-1.5 pe-4">{m.display_name}</td>
                      <td className="num py-1.5 pe-4">
                        {m.days}
                        {m.openStay ? " (open)" : ""}
                      </td>
                      <td className="num py-1.5 pe-4">{m.longestStay}</td>
                      <td className="py-1.5 pe-4">
                        <RiskPill risk={m.risk} />
                      </td>
                      <td className="py-1.5 text-end">
                        {canExplain ? (
                          <button
                            type="button"
                            onClick={() => setOpen(isOpen ? null : m.user_id)}
                            aria-expanded={isOpen}
                            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                          >
                            {isOpen ? "Hide working" : "Show working"}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    {why ? (
                      <tr className="border-b border-border/60 bg-surface-2">
                        <td colSpan={5} className="space-y-2 px-3 py-3 text-xs">
                          <p className="text-muted-foreground">
                            Window {why.windowStart} to {why.windowEnd} (rolling 12 months). Both
                            the entry and exit day count. Threshold {why.thresholdDays} days, on a{" "}
                            {why.basisLabel} basis.
                          </p>
                          <ul className="space-y-1">
                            {why.stays.map((st) => (
                              <li
                                key={`${st.entry_date}-${st.exit_date ?? "open"}`}
                                className="num flex flex-wrap justify-between gap-2"
                              >
                                <span>
                                  {st.entry_date} to {st.exit_date ?? "no exit date"}
                                  {st.clipped ? ` · counted from ${st.countedFrom}` : ""}
                                  {st.open ? ` · counted to ${st.countedTo}` : ""}
                                </span>
                                <span>{st.days} days</span>
                              </li>
                            ))}
                            <li className="num flex justify-between gap-2 border-t border-border pt-1 font-semibold">
                              <span>Total</span>
                              <span>{why.total} days</span>
                            </li>
                          </ul>
                          {why.overlapDays > 0 ? (
                            <p className="text-warning">
                              {why.overlapDays} {why.overlapDays === 1 ? "day sits" : "days sit"} in
                              overlapping entries and {why.overlapDays === 1 ? "is" : "are"} counted
                              twice. Ask the employee to correct the dates.
                            </p>
                          ) : null}
                          <p className="text-muted-foreground">
                            Recorded presence only. Self-reported by the employee.
                          </p>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function EmployeesTab({ overview }: { overview: Overview }) {
  return (
    <div className="space-y-3">
      {overview.members.length === 0 ? (
        <div className="panel p-4 text-sm text-muted-foreground">No active seats yet.</div>
      ) : null}
      {overview.members.map((m) => (
        <div key={m.user_id} className="panel space-y-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">{m.display_name}</span>
            <RiskPill risk={m.risk} />
          </div>
          {m.countries.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No travel logged. Absence of entries is not evidence of absence of travel.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {m.countries.map((c) => (
                <li key={c.country_code} className="flex flex-wrap justify-between gap-2">
                  <span>{c.country}</span>
                  <span className="num text-muted-foreground">
                    {c.days} days · threshold {c.thresholdDays}
                    {c.policyMaxDays !== null ? ` · policy ${c.policyMaxDays}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-muted-foreground">
            Day counts and thresholds only — nothing personal is available on this screen.
          </p>
        </div>
      ))}
    </div>
  );
}

function RequestsTab({
  data,
  overview,
  onChange,
}: {
  data: Dashboard;
  overview: Overview;
  onChange: () => void;
}) {
  const { i18n } = useTranslation();
  const decide = useServerFn(decideTravelRequest);
  const nameOf = (userId: string) =>
    data.members.find((m) => m.user_id === userId)?.display_name || "Team member";

  async function act(id: string, status: "approved" | "declined") {
    try {
      await decide({ data: { id, status } });
      toast.success(`Request ${status}. Decision recorded in the audit trail.`);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record that decision.");
    }
  }

  const pending = data.requests.filter((r) => r.status === "pending");
  const decided = data.requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Pending ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="panel p-4 text-sm text-muted-foreground">Nothing waiting on you.</div>
        ) : null}
        {pending.map((r) => {
          const impact = requestImpact(
            {
              user_id: r.user_id,
              country_code: r.country_code,
              start_date: r.start_date,
              end_date: r.end_date,
            },
            data.rows,
            data.policies,
            nameOf(r.user_id),
            todayIso(),
          );
          return (
            <div key={r.id} className="panel space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  {nameOf(r.user_id)} → {impact.country}
                </span>
                <RiskPill risk={impact.risk} />
              </div>
              <p className="num text-xs text-muted-foreground">
                {formatDate(r.start_date, i18n.language)} → {formatDate(r.end_date, i18n.language)}{" "}
                · {impact.requestedDays} days
              </p>
              <p className="text-sm">{impact.sentence}</p>
              {(() => {
                const rights = workRightsFor(r.country_code);
                return rights ? (
                  <p className="text-xs text-muted-foreground">
                    Remote work there on visitor status: {STATUS_LABEL[rights.visitorWork.status]}.{" "}
                    <Link
                      to="/work-rights/$code"
                      params={{ code: rights.countryCode.toLowerCase() }}
                      className="underline underline-offset-2"
                    >
                      Sources
                    </Link>
                  </p>
                ) : null;
              })()}
              <p className="num text-xs text-muted-foreground">
                {impact.headroomBefore >= 0
                  ? `${impact.headroomBefore} days of headroom now`
                  : `${-impact.headroomBefore} days past the limit already`}
                {" · "}
                {impact.headroomAfter >= 0
                  ? `${impact.headroomAfter} left if approved`
                  : `${-impact.headroomAfter} over if approved as asked`}
                {impact.headroomAfter < 0 && impact.latestCompliantEnd
                  ? ` · latest end date within the limit: ${formatDate(impact.latestCompliantEnd, i18n.language)}`
                  : ""}
              </p>
              {r.note ? <p className="text-xs text-muted-foreground">“{r.note}”</p> : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void act(r.id, "approved")}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => void act(r.id, "declined")}
                  className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-surface-2"
                >
                  Decline
                </button>
              </div>
            </div>
          );
        })}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Decided</h2>
        <div className="panel space-y-1 p-4 text-sm">
          {decided.length === 0 ? (
            <p className="text-muted-foreground">No decisions recorded yet.</p>
          ) : (
            decided.map((r) => (
              <div key={r.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {nameOf(r.user_id)} · {r.country_code}
                </span>
                <span className="num text-muted-foreground">
                  {formatDate(r.start_date, i18n.language)} →{" "}
                  {formatDate(r.end_date, i18n.language)} · {r.status}
                  {r.decided_at ? ` · ${formatDate(r.decided_at, i18n.language)}` : ""}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Approvals are recorded against {overview.windowStart}–{overview.windowEnd} day counts as
        they stood at the time of the decision.
      </p>
    </div>
  );
}

/**
 * One-click starting points. They fill the form rather than saving, so the
 * admin reads what they are about to enforce. The numbers are policy choices,
 * not legal thresholds: tax and visa limits still apply on top.
 */
const POLICY_TEMPLATES: {
  label: string;
  values: { country_code: string; max_days: number; requires_approval: boolean; note: string };
}[] = [
  {
    label: "Short workation: 30 days, approval",
    values: {
      country_code: "",
      max_days: 30,
      requires_approval: true,
      note: "Workation cap. Longer stays need approval.",
    },
  },
  {
    label: "Extended stay: 60 days, approval",
    values: {
      country_code: "",
      max_days: 60,
      requires_approval: true,
      note: "Extended remote stay, reviewed before it starts.",
    },
  },
  {
    label: "Light touch: 90 days, no approval",
    values: {
      country_code: "",
      max_days: 90,
      requires_approval: false,
      note: "Flag only. No approval step.",
    },
  },
];

function SeatsTab({
  data,
  plan,
  onChange,
}: {
  data: Dashboard;
  plan: OrgPlan;
  onChange: () => void;
}) {
  const invite = useServerFn(inviteSeat);
  const remove = useServerFn(removeSeat);
  const savePolicy = useServerFn(upsertPolicy);
  const dropPolicy = useServerFn(deletePolicy);
  const [email, setEmail] = useState("");
  const [policy, setPolicy] = useState({
    country_code: "",
    max_days: 30,
    requires_approval: true,
    note: "",
  });
  const [checkout, setCheckout] = useState<CheckoutRequest | null>(null);
  const openPortal = useServerFn(createPortalSession);
  const orgId = data.org!.id;
  const purchasedSeats = data.org!.seats_purchased;
  const seatsInUse = data.members.filter((m) => m.status !== "left").length;
  const [choice, setChoice] = useState<PlanChoice>({
    tier: plan === "unpaid" ? "advanced" : plan,
    seats: clampSeats(purchasedSeats),
  });

  async function manageBilling() {
    try {
      const result = await openPortal({
        data: { environment: getStripeEnvironment(), returnUrl: window.location.href },
      });
      if ("url" in result) window.location.assign(result.url);
      else if ("error" in result) toast.error(result.error);
      else toast.message(result.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open billing.");
    }
  }

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    try {
      await invite({ data: { org_id: orgId, email, role: "member" } });
      setEmail("");
      toast.success("Seat invited.");
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not invite that address.");
    }
  }

  async function onRemove(memberId: string) {
    if (!window.confirm("Remove this seat? It severs the org link only — their data stays theirs."))
      return;
    try {
      await remove({ data: { member_id: memberId } });
      toast.success("Seat removed. No personal data was touched.");
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove that seat.");
    }
  }

  async function onSavePolicy(e: React.FormEvent) {
    e.preventDefault();
    try {
      await savePolicy({
        data: {
          org_id: orgId,
          country_code: policy.country_code ? policy.country_code : null,
          max_days: policy.max_days,
          requires_approval: policy.requires_approval,
          note: policy.note,
        },
      });
      setPolicy({ country_code: "", max_days: 30, requires_approval: true, note: "" });
      toast.success("Policy saved.");
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save that policy.");
    }
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Plan and billing</h2>
        {plan === "unpaid" ? (
          <div className="panel space-y-4 p-4">
            <p className="text-sm text-muted-foreground">
              You are evaluating: {seatsInUse} of {EVALUATION_SEATS} places used, with the Basic
              features. Choose a plan to add your team and unlock the rest.
            </p>
            <PlanPicker value={choice} onChange={setChoice} />
            <button
              type="button"
              onClick={() => {
                if (!paymentsAvailable()) {
                  toast.error("Checkout is not available on this build yet.");
                  return;
                }
                setCheckout({
                  plan: "teams",
                  interval: "yearly",
                  seats: clampSeats(choice.seats),
                  tier: choice.tier,
                });
              }}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
            >
              <CreditCard className="h-4 w-4" aria-hidden />
              Start {TRIAL_DAYS}-day trial
            </button>
          </div>
        ) : (
          <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{businessTier(plan).name}</span> plan ·{" "}
              {seatsInUse} of {purchasedSeats} seats in use. Change plan, add seats, update the card
              or cancel in the billing portal.
            </p>
            <button
              type="button"
              onClick={() => void manageBilling()}
              className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              <CreditCard className="h-3.5 w-3.5" aria-hidden />
              Manage billing
            </button>
          </div>
        )}
        {checkout ? (
          <CheckoutDialog request={checkout} returnPath="/org" onClose={() => setCheckout(null)} />
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Seats</h2>
        <form onSubmit={onInvite} className="panel flex flex-wrap items-end gap-3 p-4">
          <label className="min-w-[220px] flex-1 space-y-1">
            <span className="label-xs">Invite by work email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            Invite
          </button>
        </form>
        <div className="panel divide-y divide-border p-0">
          {data.members.map((m) => (
            <div key={m.member_id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
              <span className="flex-1">
                {m.display_name || m.invite_email || "Invited"}{" "}
                <span className="text-xs text-muted-foreground">
                  · {m.role} · {m.status}
                </span>
              </span>
              {m.status !== "left" ? (
                <button
                  type="button"
                  onClick={() => void onRemove(m.member_id)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs transition-colors hover:bg-surface-2"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Removing a seat severs the organisation link and never touches the person&rsquo;s account,
          history or documents.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Policy limits</h2>
        {orgHasFeature(plan, "policies") ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Start from a template:</span>
              {POLICY_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => setPolicy({ ...tpl.values })}
                  className="rounded-md border border-border px-2.5 py-1 text-xs transition-colors hover:bg-surface-2"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
            <form onSubmit={onSavePolicy} className="panel flex flex-wrap items-end gap-3 p-4">
              <label className="space-y-1">
                <span className="label-xs">Country code (blank = global)</span>
                <input
                  value={policy.country_code}
                  maxLength={2}
                  onChange={(e) =>
                    setPolicy({ ...policy, country_code: e.target.value.toUpperCase() })
                  }
                  placeholder="DE"
                  className="w-24 rounded-md border border-border bg-surface-1 px-3 py-2 text-sm uppercase"
                />
              </label>
              <label className="space-y-1">
                <span className="label-xs">Max days</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={policy.max_days}
                  onChange={(e) => setPolicy({ ...policy, max_days: Number(e.target.value) })}
                  className="w-24 rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={policy.requires_approval}
                  onChange={(e) => setPolicy({ ...policy, requires_approval: e.target.checked })}
                />
                Requires approval
              </label>
              <label className="min-w-[200px] flex-1 space-y-1">
                <span className="label-xs">Note</span>
                <input
                  value={policy.note}
                  onChange={(e) => setPolicy({ ...policy, note: e.target.value })}
                  className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
                />
              </label>
              <button
                type="submit"
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              >
                Add
              </button>
            </form>
            <div className="panel divide-y divide-border p-0">
              {data.policies.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">
                  No limits set. Country tax-residency thresholds still apply.
                </p>
              ) : null}
              {data.policies.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                  <span className="flex-1">
                    {p.country_code ?? "All countries"} · max{" "}
                    <span className="num">{p.max_days}</span> days
                    {p.requires_approval ? " · approval required" : ""}
                    {p.note ? ` · ${p.note}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await dropPolicy({ data: { id: p.id } });
                      onChange();
                    }}
                    className="rounded-md border border-border px-2 py-1 text-xs transition-colors hover:bg-surface-2"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <Locked
            feature="policies"
            what="Company travel limits per country, with an approval step"
          />
        )}
      </section>
    </div>
  );
}
