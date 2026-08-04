import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, LogOut } from "lucide-react";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/app";
import { Stat } from "@/components/Primitives";
import { RequiresNetwork } from "@/components/OfflineBanner";
import { useSession } from "@/lib/use-session";
import { useOrgTripSync } from "@/lib/org/use-trip-sync";
import {
  getMyOrgContext,
  getMySharedPresence,
  leaveOrganisation,
} from "@/lib/org/org.functions";
import { buildOrgOverview, PE_BENCHMARK_LABEL } from "@/lib/org/presence";
import { todayIso } from "@/lib/trip-dates";

export const Route = createFileRoute("/settings/employer-sharing")({
  head: () => ({
    meta: [
      { title: `What your company can see | ${APP_NAME}` },
      {
        name: "description",
        content:
          "The exact rows your employer can read from your account, rendered from the same query their dashboard runs. Country and dates only.",
      },
      { property: "og:title", content: `What your company can see | ${APP_NAME}` },
      {
        property: "og:description",
        content: "Country and dates only — rendered from the employer's own query.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmployerSharing,
});

const NOT_SHARED = [
  "The community radar and your profile",
  "Income, savings and arbitrage calculations",
  "Saved cities and anything you browse",
  "Your document vault",
  "Personal notes on trips",
  "Precise location, of any kind",
];

function EmployerSharing() {
  const { signedIn, ready } = useSession();
  const qc = useQueryClient();
  useOrgTripSync(signedIn);

  const fetchContext = useServerFn(getMyOrgContext);
  const fetchShared = useServerFn(getMySharedPresence);
  const leave = useServerFn(leaveOrganisation);

  const ctx = useQuery({
    queryKey: ["org-context"],
    queryFn: () => fetchContext({}),
    enabled: signedIn,
  });
  const shared = useQuery({
    queryKey: ["org-shared-presence"],
    queryFn: () => fetchShared({}),
    enabled: signedIn,
  });

  if (!ready) return null;
  if (!signedIn) {
    return (
      <div className="panel p-5 text-sm">
        <Link to="/auth" search={{ next: "/settings/employer-sharing" }} className="underline">
          Sign in
        </Link>{" "}
        to see what your company can read from your account.
      </div>
    );
  }

  if (ctx.isLoading || shared.isLoading) {
    return (
      <RequiresNetwork reason="This screen deliberately reads the employer's own view, so it needs a connection — showing you a cached copy could tell you something friendlier than the truth.">
        <div />
      </RequiresNetwork>
    );
  }

  const membership = ctx.data?.membership ?? null;
  const rows = shared.data?.rows ?? [];

  async function onLeave() {
    if (!window.confirm("Leave the organisation? Your account, history and documents stay yours.")) return;
    try {
      await leave({});
      toast.success("Organisation link severed. Nothing of yours was deleted.");
      await qc.invalidateQueries({ queryKey: ["org-context"] });
      await qc.invalidateQueries({ queryKey: ["org-shared-presence"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not leave right now.");
    }
  }

  if (!membership) {
    return (
      <div className="max-w-3xl space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">What your company can see</h1>
        <div className="panel p-5 text-sm text-muted-foreground">
          You are not linked to an organisation, so nothing is shared with anyone. If your employer
          buys a seat you will see the exact rows here before they see anything.{" "}
          <Link to="/business/explain" className="underline">
            How employer sharing works
          </Link>
          .
        </div>
      </div>
    );
  }

  const overview = buildOrgOverview(
    rows,
    [
      {
        user_id: rows[0]?.user_id ?? "self",
        member_id: membership.member_id,
        display_name: "You",
        invite_email: null,
        role: membership.role,
        status: "active",
        joined_at: membership.joined_at,
      },
    ],
    ctx.data?.policies ?? [],
    todayIso(),
  );
  const me = overview.members[0];

  return (
    <div className="max-w-4xl space-y-6 pb-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">What {membership.org.name} can see</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Everything below is rendered from the same query their dashboard runs, against the same
          restricted view. It cannot drift out of sync with what they actually see.
        </p>
      </header>

      <section className="panel space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold">Shared: country and dates</h2>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No trips logged, so there is nothing to share yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-1.5 pr-4 font-medium">Country</th>
                  <th className="py-1.5 pr-4 font-medium">Entry</th>
                  <th className="py-1.5 pr-4 font-medium">Exit</th>
                  <th className="py-1.5 font-medium">Logged</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.trip_id} className="border-b border-border/60">
                    <td className="num py-1.5 pr-4">{r.country_code}</td>
                    <td className="num py-1.5 pr-4">{r.entry_date}</td>
                    <td className="num py-1.5 pr-4">{r.exit_date ?? "open"}</td>
                    <td className="num py-1.5 text-muted-foreground">
                      {r.logged_at?.slice(0, 10) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel space-y-3 p-4">
        <h2 className="text-sm font-semibold">Shared: day counts and flags</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Countries" value={me?.countries.length ?? 0} size="sm" />
          <Stat
            label="Longest count"
            value={me?.peDaysMax ?? 0}
            hint={me?.peCountry ?? "no data"}
            size="sm"
          />
          <Stat
            label="Status"
            value={me?.risk ?? "clear"}
            tone={me?.risk === "over" ? "negative" : me?.risk === "approaching" ? "default" : "positive"}
            size="sm"
          />
          <Stat label="Window" value="12 months" hint="rolling" size="sm" />
        </div>
        {me && me.countries.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {me.countries.map((c) => (
              <li key={c.country_code} className="flex flex-wrap justify-between gap-2">
                <span>{c.country}</span>
                <span className="num text-muted-foreground">
                  {c.days} days · threshold {c.thresholdDays}
                  {c.policyMaxDays !== null ? ` · policy ${c.policyMaxDays}` : ""} · {c.risk}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-xs text-muted-foreground">{PE_BENCHMARK_LABEL}.</p>
      </section>

      <section className="panel space-y-2 p-4">
        <div className="flex items-center gap-2">
          <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold">Never shared</h2>
        </div>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {NOT_SHARED.map((x) => (
            <li key={x} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              {x}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel space-y-2 p-4">
        <h2 className="text-sm font-semibold">Leave {membership.org.name}</h2>
        <p className="text-sm text-muted-foreground">
          This severs the organisation link only. Your account, your travel history and your
          documents remain yours, and the company stops seeing new day-counts immediately.
        </p>
        <button
          onClick={onLeave}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-surface-2"
        >
          <LogOut className="h-4 w-4" aria-hidden /> Leave organisation
        </button>
      </section>
    </div>
  );
}
