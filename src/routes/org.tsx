import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  CreditCard,
  Download,
  Loader2,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { APP_NAME, LEGAL_DISCLAIMER } from "@/lib/app";
import { Stat } from "@/components/Primitives";
import { RequiresNetwork } from "@/components/OfflineBanner";
import { CreateOrgFlow } from "@/components/org/CreateOrgFlow";
import { CheckoutDialog, type CheckoutRequest } from "@/components/billing/CheckoutDialog";
import { paymentsAvailable, getStripeEnvironment } from "@/lib/stripe";
import { verifyCheckoutSession } from "@/lib/billing/billing.functions";
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
import { monthlyTotal, usd } from "@/lib/org/pricing";
import { buildActionItems, type ActionItem } from "@/lib/org/actions";
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
  const { patchProfile } = useProfile();
  const [state, setState] = useState<"working" | "granted" | "pending" | "failed">("working");
  const [message, setMessage] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      try {
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

  const overview = useMemo(
    () => (data ? buildOrgOverview(data.rows, data.members, data.policies, todayIso()) : null),
    [data],
  );

  const actions = useMemo(
    () =>
      data && overview ? buildActionItems(overview, data.rows, data.requests, todayIso()) : [],
    [data, overview],
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
  if (!data?.isAdmin || !data.org || !overview) {
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

  return (
    <div className="space-y-5 pb-6">
      {checkout === "success" && sessionId ? (
        <TeamsCheckoutBanner
          sessionId={sessionId}
          onDone={() => {
            refresh();
            clearCheckoutParams();
          }}
        />
      ) : null}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{org.name}</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" aria-hidden /> Country and dates only
          </span>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Employees can see this exact data on their own settings screen. Nothing personal — no
          location, documents, income or notes — reaches this dashboard.
        </p>
      </header>

      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              tab === t
                ? "bg-surface-2 text-foreground"
                : "text-muted-foreground hover:bg-surface-2",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Risk" ? (
        <RiskTab
          actions={actions}
          onJump={setTab}
          overview={overview}
          orgName={org.name}
          seats={{ activeSeats, invited, purchased: org.seats_purchased }}
        />
      ) : null}
      {tab === "Countries" ? <CountriesTab overview={overview} /> : null}
      {tab === "Employees" ? <EmployeesTab overview={overview} /> : null}
      {tab === "Requests" ? (
        <RequestsTab data={data} overview={overview} onChange={refresh} />
      ) : null}
      {tab === "Seats" ? <SeatsTab data={data} onChange={refresh} /> : null}

      <p className="text-[11px] leading-relaxed text-muted-foreground">{LEGAL_DISCLAIMER}</p>
    </div>
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
function ActionCenter({ items, onJump }: { items: ActionItem[]; onJump: (tab: Tab) => void }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? items : items.slice(0, 5);
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
      {items.length > 5 ? (
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

function RiskTab({
  actions,
  onJump,
  overview,
  orgName,
  seats,
}: {
  actions: ActionItem[];
  onJump: (tab: Tab) => void;
  overview: Overview;
  orgName: string;
  seats: { activeSeats: number; invited: number; purchased: number };
}) {
  const [country, setCountry] = useState<string>("");
  const filter = country || null;

  async function exportCsv() {
    downloadBlob(
      new Blob([auditToCsv(overview, orgName, filter)], { type: "text/csv;charset=utf-8" }),
      auditFileName(orgName, "csv"),
    );
  }
  async function exportPdf() {
    downloadBlob(await auditToPdf(overview, orgName, filter), auditFileName(orgName, "pdf"));
  }

  return (
    <div className="space-y-5">
      <ActionCenter items={actions} onJump={onJump} />
      <div className="panel grid grid-cols-2 gap-4 p-4 sm:grid-cols-5">
        <Stat label="Over a limit" value={overview.counts.over} tone="negative" size="sm" />
        <Stat label="Approaching" value={overview.counts.approaching} size="sm" />
        <Stat label="Clear" value={overview.counts.clear} tone="positive" size="sm" />
        <Stat label="No data logged" value={overview.counts.noData} tone="muted" size="sm" />
        <Stat
          label="Seats"
          value={`${seats.activeSeats}/${seats.purchased}`}
          hint={seats.invited > 0 ? `${seats.invited} invited` : "active"}
          size="sm"
        />
      </div>

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

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Data quality</h2>
        <p className="text-xs text-muted-foreground">{AUDIT_DISCLAIMER}</p>
        <div className="panel space-y-1.5 p-4 text-sm">
          {overview.flags.length === 0 ? (
            <p className="text-muted-foreground">
              No flags raised. Every recorded stay has an entry and an exit date.
            </p>
          ) : (
            overview.flags.slice(0, 40).map((f, i) => (
              <div key={`${f.kind}-${i}`}>
                <span className="font-medium">{f.label}</span>{" "}
                <span className="text-muted-foreground">{f.detail}</span>
              </div>
            ))
          )}
        </div>
      </section>

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
          <button
            type="button"
            onClick={() => void exportPdf()}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-surface-2"
          >
            <Download className="h-4 w-4" aria-hidden /> PDF
          </button>
          <span className="text-xs text-muted-foreground">
            Period {overview.windowStart} → {overview.windowEnd}
          </span>
        </div>
      </section>
    </div>
  );
}

function CountriesTab({ overview }: { overview: Overview }) {
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
                <th className="py-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {country.members.map((m) => (
                <tr key={m.user_id} className="border-b border-border/60">
                  <td className="py-1.5 pe-4">{m.display_name}</td>
                  <td className="num py-1.5 pe-4">
                    {m.days}
                    {m.openStay ? " (open)" : ""}
                  </td>
                  <td className="num py-1.5 pe-4">{m.longestStay}</td>
                  <td className="py-1.5">
                    <RiskPill risk={m.risk} />
                  </td>
                </tr>
              ))}
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

function SeatsTab({ data, onChange }: { data: Dashboard; onChange: () => void }) {
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
  const orgId = data.org!.id;
  const purchasedSeats = data.org!.seats_purchased;

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
        <h2 className="text-sm font-semibold">Billing</h2>
        <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-muted-foreground">
            {purchasedSeats} seats on file · {usd(monthlyTotal(purchasedSeats))}/month at the
            standard rate. Started on an invoice, or want to switch to card billing?
          </p>
          <button
            type="button"
            onClick={() => {
              if (!paymentsAvailable()) {
                toast.error("Checkout is not available on this build yet.");
                return;
              }
              setCheckout({ plan: "teams", interval: "monthly", seats: purchasedSeats });
            }}
            className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            <CreditCard className="h-3.5 w-3.5" aria-hidden />
            Pay by card
          </button>
        </div>
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
        <form onSubmit={onSavePolicy} className="panel flex flex-wrap items-end gap-3 p-4">
          <label className="space-y-1">
            <span className="label-xs">Country code (blank = global)</span>
            <input
              value={policy.country_code}
              maxLength={2}
              onChange={(e) => setPolicy({ ...policy, country_code: e.target.value.toUpperCase() })}
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
                {p.country_code ?? "All countries"} · max <span className="num">{p.max_days}</span>{" "}
                days
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
      </section>
    </div>
  );
}
