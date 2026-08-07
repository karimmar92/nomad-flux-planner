import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { APP_NAME } from "@/lib/app";
import { useSession } from "@/lib/use-session";
import {
  createAdjustment,
  getAdminOverview,
  resolveFlag,
  reviewApplication,
} from "@/lib/referrals/admin.functions";
import { formatUsd } from "@/lib/referrals/config";
import { formatDate } from "@/lib/i18n/format";

export const Route = createFileRoute("/admin/creators")({
  head: () => ({
    meta: [
      { title: `Creator admin | ${APP_NAME}` },
      { name: "description", content: "Review creator applications, flags and ledger adjustments." },
      { property: "og:title", content: `Creator admin | ${APP_NAME}` },
      { property: "og:description", content: "Internal review queue for the creator programme." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminCreatorsPage,
});

function AdminCreatorsPage() {
  const { i18n } = useTranslation();
  const { signedIn, ready } = useSession();
  const fetchOverview = useServerFn(getAdminOverview);
  const qc = useQueryClient();

  const { data, error, isLoading } = useQuery({
    queryKey: ["admin-creators"],
    queryFn: () => fetchOverview({}),
    enabled: signedIn,
    retry: false,
  });

  const review = useServerFn(reviewApplication);
  const flagAction = useServerFn(resolveFlag);
  const adjust = useServerFn(createAdjustment);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-creators"] });

  if (!ready) return null;
  if (!signedIn || error) {
    return (
      <p className="panel p-4 text-sm text-muted-foreground">
        This page is restricted to administrators.
      </p>
    );
  }
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Creator admin</h1>

      <section className="panel space-y-3 p-4">
        <h2 className="label-xs">Applications</h2>
        {data.applications.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to review.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.applications.map((a) => (
              <li key={a.id} className="space-y-1 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{a.contact_email}</span>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">{a.status}</span>
                  <span className="text-xs text-muted-foreground">
                    {a.primary_channel}
                    {a.audience_size ? ` · ${a.audience_size.toLocaleString()}` : ""}
                  </span>
                </div>
                <p className="text-muted-foreground">{a.audience_description}</p>
                {a.status === "pending" ? (
                  <div className="flex gap-2 pt-1">
                    <button type="button"
                      className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                      onClick={async () => {
                        await review({ data: { id: a.id, decision: "approved" } });
                        toast.success("Approved");
                        refresh();
                      }}
                    >
                      Approve
                    </button>
                    <button type="button"
                      className="rounded-full border border-border px-3 py-1 text-xs"
                      onClick={async () => {
                        await review({ data: { id: a.id, decision: "rejected" } });
                        toast("Rejected");
                        refresh();
                      }}
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel space-y-3 p-4">
        <h2 className="label-xs">Soft-flag queue</h2>
        <p className="text-xs text-muted-foreground">
          Flags never block an accrual. Shared coworking IPs are normal for this audience — treat IP
          clusters as context, not evidence.
        </p>
        {data.flags.length === 0 ? (
          <p className="text-sm text-muted-foreground">Queue is clear.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {data.flags.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="font-medium">{f.kind}</span>
                <code className="num text-xs text-muted-foreground">
                  {JSON.stringify(f.detail)}
                </code>
                <div className="ms-auto flex gap-2">
                  <button type="button"
                    className="rounded-full border border-border px-3 py-1 text-xs"
                    onClick={async () => {
                      await flagAction({ data: { id: f.id, status: "cleared" } });
                      refresh();
                    }}
                  >
                    Clear
                  </button>
                  <button type="button"
                    className="rounded-full border border-border px-3 py-1 text-xs"
                    onClick={async () => {
                      await flagAction({ data: { id: f.id, status: "actioned" } });
                      refresh();
                    }}
                  >
                    Actioned
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AdjustmentForm
        creators={data.creators}
        onSubmit={async (input) => {
          await adjust({ data: input });
          toast.success("Ledger row appended");
          refresh();
        }}
      />

      <section className="panel p-4">
        <h2 className="label-xs mb-2">Recent adjustments</h2>
        {data.recentAdjustments.length === 0 ? (
          <p className="text-sm text-muted-foreground">None.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {data.recentAdjustments.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <span className="num">{formatUsd(r.amount_cents)}</span>
                <span className="text-muted-foreground">{r.note}</span>
                <span className="num ms-auto text-xs text-muted-foreground">
                  {formatDate(r.created_at, i18n.language)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AdjustmentForm({
  creators,
  onSubmit,
}: {
  creators: { id: string; code: string }[];
  onSubmit: (input: { creator_id: string; amount_cents: number; note: string }) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <section className="panel space-y-3 p-4">
      <h2 className="label-xs">Manual adjustment</h2>
      <p className="text-xs text-muted-foreground">
        Appends a signed ledger row. Nothing is ever edited or deleted, and a note is mandatory.
      </p>
      <form
        className="grid gap-3 sm:grid-cols-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setBusy(true);
          try {
            await onSubmit({
              creator_id: String(form.get("creator_id") ?? ""),
              amount_cents: Math.round(Number(form.get("amount") ?? 0) * 100),
              note: String(form.get("note") ?? ""),
            });
            (e.target as HTMLFormElement).reset();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not append row.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <select name="creator_id" className="input" required>
          <option value="">Creator…</option>
          {creators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}
            </option>
          ))}
        </select>
        <input
          name="amount"
          type="number"
          step="0.01"
          placeholder="Amount in USD (negative allowed)"
          className="input"
          required
        />
        <input name="note" placeholder="Reason (required)" className="input" required minLength={5} />
        <div className="sm:col-span-3">
          <button type="button"
            disabled={busy}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            Append ledger row
          </button>
        </div>
      </form>
    </section>
  );
}
