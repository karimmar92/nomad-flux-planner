import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { APP_NAME } from "@/lib/app";
import { useSession } from "@/lib/use-session";
import { listWaitlistLeads, type WaitlistLead } from "@/lib/admin/admin.functions";

export const Route = createFileRoute("/admin/waitlist")({
  head: () => ({
    meta: [
      { title: `Waitlist leads | ${APP_NAME}` },
      { name: "description", content: "Community and Stays waitlist sign-ups by feature." },
      { property: "og:title", content: `Waitlist leads | ${APP_NAME}` },
      { property: "og:description", content: "Internal list of coming-soon feature sign-ups." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminWaitlistPage,
});

/**
 * CSV INJECTION: a spreadsheet treats a cell starting with = + - @ as a
 * formula, even inside quotes. Emails are user-supplied, so they get the same
 * apostrophe guard the presence export uses.
 */
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;
function csvCell(value: string | number | null): string {
  const s = value === null ? "" : String(value);
  const safe = typeof value === "string" && FORMULA_TRIGGERS.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function toCsv(rows: WaitlistLead[]): string {
  const head = ["email", "feature", "city_id", "signed_up_at"];
  const body = rows.map((r) => [r.email, r.feature, r.city_id ?? "", r.created_at]);
  return [head, ...body].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminWaitlistPage() {
  const { signedIn, ready } = useSession();
  const fetchLeads = useServerFn(listWaitlistLeads);
  const [feature, setFeature] = useState("all");
  const [q, setQ] = useState("");
  const [since, setSince] = useState("");

  const { data, error, isLoading } = useQuery({
    queryKey: ["admin-waitlist"],
    queryFn: () => fetchLeads({}),
    enabled: signedIn,
    retry: false,
  });

  const features = useMemo(
    () => Array.from(new Set((data ?? []).map((r) => r.feature))).sort(),
    [data],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (feature !== "all" && r.feature !== feature) return false;
      if (since && r.created_at < since) return false;
      if (needle && !`${r.email} ${r.city_id ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data, feature, q, since]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data ?? []) m.set(r.feature, (m.get(r.feature) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  if (!ready) return null;
  if (!signedIn || error)
    return (
      <p className="panel p-4 text-sm text-muted-foreground">
        This page is restricted to administrators.
      </p>
    );
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Waitlist leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign-ups from the coming-soon tabs, grouped by the feature someone asked for.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {counts.map(([f, n]) => (
          <span key={f} className="panel px-3 py-1.5 text-xs">
            <span className="font-medium">{f}</span>{" "}
            <span className="text-muted-foreground">{n}</span>
          </span>
        ))}
        {counts.length === 0 ? (
          <span className="text-sm text-muted-foreground">No sign-ups yet.</span>
        ) : null}
      </div>

      <div className="panel flex flex-wrap items-end gap-3 p-3">
        <label className="text-xs">
          <span className="label-xs block">Feature</span>
          <select
            value={feature}
            onChange={(e) => setFeature(e.target.value)}
            className="mt-1 rounded-md border border-input bg-surface px-2 py-1.5 text-sm"
          >
            <option value="all">All</option>
            {features.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="label-xs block">Search email or city</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="name@example.com"
            className="mt-1 rounded-md border border-input bg-surface px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="label-xs block">Signed up on or after</span>
          <input
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className="mt-1 rounded-md border border-input bg-surface px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() =>
            download(
              `waitlist-${feature}-${new Date().toISOString().slice(0, 10)}.csv`,
              toCsv(rows),
            )
          }
          disabled={rows.length === 0}
          className="ms-auto rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          Export {rows.length} as CSV
        </button>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-start">
              <th className="p-2 text-start font-medium">Email</th>
              <th className="p-2 text-start font-medium">Feature</th>
              <th className="p-2 text-start font-medium">City</th>
              <th className="p-2 text-start font-medium">Signed up</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0">
                <td className="p-2">{r.email}</td>
                <td className="p-2">{r.feature}</td>
                <td className="p-2 text-muted-foreground">{r.city_id ?? "—"}</td>
                <td className="p-2 text-muted-foreground">
                  {new Date(r.created_at).toISOString().slice(0, 16).replace("T", " ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No leads match these filters.</p>
        ) : null}
      </div>
    </div>
  );
}
