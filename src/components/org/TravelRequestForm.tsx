import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createTravelRequest } from "@/lib/org/org.functions";
import { requestImpact, type OrgPolicy, type PresenceRow } from "@/lib/org/presence";
import { todayIso } from "@/lib/trip-dates";

/**
 * Employee-side travel proposal. The compliance implication is shown to the
 * employee before they send it, using the same maths the approver will see —
 * no surprises in either direction.
 */
export function TravelRequestForm({
  orgId,
  rows,
  policies,
  userId,
}: {
  orgId: string;
  rows: PresenceRow[];
  policies: OrgPolicy[];
  userId: string;
}) {
  const qc = useQueryClient();
  const submit = useServerFn(createTravelRequest);
  const [form, setForm] = useState({
    country_code: "",
    start_date: todayIso(),
    end_date: todayIso(),
    note: "",
  });
  const [busy, setBusy] = useState(false);

  const ready =
    form.country_code.length === 2 && form.start_date <= form.end_date;
  const impact = ready
    ? requestImpact(
        {
          user_id: userId,
          country_code: form.country_code,
          start_date: form.start_date,
          end_date: form.end_date,
        },
        rows,
        policies,
        "you",
        todayIso(),
      )
    : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await submit({ data: { org_id: orgId, ...form } });
      toast.success("Request sent for approval.");
      setForm({ ...form, note: "" });
      await qc.invalidateQueries({ queryKey: ["org-context"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send that request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <label className="space-y-1">
          <span className="label-xs">Country code</span>
          <input
            value={form.country_code}
            maxLength={2}
            onChange={(e) => setForm({ ...form, country_code: e.target.value.toUpperCase() })}
            placeholder="ES"
            className="w-20 rounded-md border border-border bg-surface-1 px-3 py-2 text-sm uppercase"
          />
        </label>
        <label className="space-y-1">
          <span className="label-xs">From</span>
          <input
            type="date"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            className="rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="label-xs">To</span>
          <input
            type="date"
            value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            className="rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
          />
        </label>
        <label className="min-w-[180px] flex-1 space-y-1">
          <span className="label-xs">Note</span>
          <input
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
          />
        </label>
      </div>
      {impact ? <p className="text-sm">{impact.sentence}</p> : null}
      <button
        type="submit"
        disabled={!ready || busy}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {busy ? "Sending…" : "Send for approval"}
      </button>
    </form>
  );
}
