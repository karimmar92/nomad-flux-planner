/**
 * Plan detail — who is going, and one button to join or leave.
 *
 * Attendees are shown as names and headlines only. No photos, deliberately:
 * a grid of faces is what turns a meetup product into a dating one, and the
 * venue is the thing worth looking at anyway.
 *
 * Leaving is silent — no notification to the host. Someone who feels
 * uncomfortable must be able to withdraw without announcing it.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Flag, MapPin, Users } from "lucide-react";
import { APP_NAME } from "@/lib/app";
import { useSession } from "@/lib/use-session";
import { LegalFooter } from "@/components/LegalFooter";
import {
  ACTIVITY_LABEL,
  cancelPlan,
  formatPlanTime,
  getPlan,
  joinPlan,
  leavePlan,
  type PlanWithCounts,
} from "@/lib/plans/plans";

export const Route = createFileRoute("/plans/$planId")({
  head: () => ({ meta: [{ title: `Plan | ${APP_NAME}` }] }),
  component: PlanDetail,
});

const SAFETY_SEEN_KEY = "driftly.plans.safety_seen";

function PlanDetail() {
  const { planId } = Route.useParams();
  const { userId, signedIn, ready } = useSession();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<PlanWithCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSafety, setShowSafety] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPlan(await getPlan(planId, userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this plan.");
    } finally {
      setLoading(false);
    }
  }, [planId, userId]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  async function handleJoin() {
    if (!userId) return;
    // Shown once, ever. A safety note repeated every time gets dismissed
    // reflexively and stops being read.
    const seen = window.localStorage.getItem(SAFETY_SEEN_KEY);
    if (!seen) {
      setShowSafety(true);
      return;
    }
    await doJoin();
  }

  async function doJoin() {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      await joinPlan(planId, userId);
      window.localStorage.setItem(SAFETY_SEEN_KEY, "1");
      setShowSafety(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join.");
      setShowSafety(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (!userId) return;
    setBusy(true);
    try {
      await leavePlan(planId, userId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not leave.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm("Cancel this plan? Everyone going will stop seeing it.")) return;
    setBusy(true);
    try {
      await cancelPlan(planId);
      void navigate({ to: "/plans" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel.");
      setBusy(false);
    }
  }

  if (loading) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;

  if (!plan) {
    return (
      <div className="space-y-3 p-4">
        <p className="text-sm text-muted-foreground">
          This plan is no longer available. It may have been cancelled or already happened.
        </p>
        <Link to="/plans" className="text-sm font-medium text-primary underline">
          Back to plans
        </Link>
      </div>
    );
  }

  const full = plan.goingCount >= plan.capacity;

  return (
    <div className="space-y-4 pb-4">
      <Link
        to="/plans"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Plans
      </Link>

      <section className="panel space-y-3 p-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {ACTIVITY_LABEL[plan.activity]}
          </h1>
          <p className="mt-1 text-sm font-medium tabular-nums">
            {formatPlanTime(plan.starts_at)}
          </p>
        </div>

        <div className="flex items-start gap-1.5 text-sm">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            {plan.venue_name}
            {plan.venue_hint ? (
              <span className="block text-xs text-muted-foreground">{plan.venue_hint}</span>
            ) : null}
          </span>
        </div>

        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="h-4 w-4" aria-hidden />
          {plan.goingCount} of {plan.capacity} going
        </p>

        {plan.note ? <p className="text-sm leading-relaxed">{plan.note}</p> : null}

        {error ? (
          <p role="alert" className="rounded-md bg-negative-muted px-2 py-1.5 text-xs text-negative">
            {error}
          </p>
        ) : null}

        {!signedIn ? (
          <Link to="/auth" className="text-sm font-medium text-primary underline">
            Sign in to join
          </Link>
        ) : plan.isHost ? (
          <button
            onClick={handleCancel}
            disabled={busy}
            className="rounded-md border border-negative/50 px-3 py-2 text-sm font-medium text-negative disabled:opacity-40"
          >
            Cancel this plan
          </button>
        ) : plan.isAttending ? (
          <button
            onClick={handleLeave}
            disabled={busy}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {busy ? "…" : "Leave"}
          </button>
        ) : full ? (
          <p className="text-sm text-muted-foreground">This plan is full.</p>
        ) : (
          <button
            onClick={handleJoin}
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            {busy ? "…" : "Join"}
          </button>
        )}
      </section>

      {showSafety ? (
        <section className="panel space-y-3 border-primary/40 p-4">
          <h2 className="text-sm font-semibold">Before you go</h2>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>Meet in the public place named above. Never at anyone&apos;s accommodation.</li>
            <li>Tell someone you trust where you&apos;re going and when.</li>
            <li>If it feels off, leave. You don&apos;t owe anyone an explanation.</li>
          </ul>
          <div className="flex items-center gap-2">
            <button
              onClick={doJoin}
              disabled={busy}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              Got it — join
            </button>
            <button
              onClick={() => setShowSafety(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Not now
            </button>
          </div>
        </section>
      ) : null}

      <p className="flex items-start gap-1.5 px-1 text-xs leading-relaxed text-muted-foreground">
        <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Something wrong with this plan? Report it from the host&apos;s profile.
          Leaving is always silent — nobody is told.
        </span>
      </p>

      <LegalFooter />
    </div>
  );
}
