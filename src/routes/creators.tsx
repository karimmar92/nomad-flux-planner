import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/app";
import { useSession } from "@/lib/use-session";
import { submitCreatorApplication } from "@/lib/referrals/creator.functions";
import { CREATOR_PROGRAM, formatUsd } from "@/lib/referrals/config";

export const Route = createFileRoute("/creators")({
  head: () => ({
    meta: [
      { title: `Creator programme — 30% recurring | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Earn 30% of subscription revenue, recurring for up to 12 months per referred user. Cash, paid monthly via Stripe Connect.",
      },
      { property: "og:title", content: `Creator programme — 30% recurring | ${APP_NAME}` },
      {
        property: "og:description",
        content: "30% recurring commission on subscriptions. Application-gated, paid in cash.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreatorsPage,
});

const CHANNELS = ["YouTube", "Newsletter", "Podcast", "Instagram", "TikTok", "Blog", "Community"];

function CreatorsPage() {
  const { signedIn } = useSession();
  const submit = useServerFn(submitCreatorApplication);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const share = Math.round(CREATOR_PROGRAM.revenueShare * 100);

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <p className="label-xs">Creator programme</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {share}% of subscription revenue, every month they stay.
        </h1>
        <p className="text-sm text-muted-foreground">
          Cash, not credit. Paid monthly via {CREATOR_PROGRAM.payoutRail}, which handles
          international onboarding and tax forms wherever you happen to be.
        </p>
      </header>

      <section className="panel grid gap-4 p-4 sm:grid-cols-3">
        <Illustration value={`${share}%`} label="of collected subscription revenue" />
        <Illustration value="12 mo" label="cap per referred user" />
        <Illustration value="$270/mo" label="≈ 100 active referred subscribers" />
      </section>

      <section className="panel space-y-2 p-4">
        <h2 className="text-sm font-semibold">The honest caveats</h2>
        <ul className="list-disc space-y-1 ps-4 text-sm text-muted-foreground">
          <li>
            Commission is capped at {CREATOR_PROGRAM.capMonthsPerReferredUser} months per referred
            user. Month 13 pays nothing.
          </li>
          <li>
            Subscriptions only. We don't share eSIM or insurance affiliate revenue — the
            third-party tracking is fragile and we'd rather not promise money we can't reconcile.
          </li>
          <li>
            Accruals clear after {CREATOR_PROGRAM.holdDays} days. Refunds and disputes are clawed
            back, and if you'd already been paid, the negative nets against your next payout.
          </li>
          <li>Minimum payout {formatUsd(CREATOR_PROGRAM.minPayoutCents)}.</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Full{" "}
          <Link to="/creator-terms" className="underline">
            programme terms
          </Link>
          . Looking for the free-month invite instead? That's the separate{" "}
          <Link to="/profile" className="underline">
            user referral programme
          </Link>
          .
        </p>
      </section>

      <section className="panel space-y-3 p-4">
        <h2 className="text-sm font-semibold">Apply</h2>

        {!signedIn ? (
          <p className="text-sm text-muted-foreground">
            <Link to="/auth" search={{ next: "/creators" }} className="underline">
              Sign in
            </Link>{" "}
            to apply — we attach the application to your account.
          </p>
        ) : sent ? (
          <p className="text-sm text-positive">
            Application received. We review weekly and email either way.
          </p>
        ) : (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              setBusy(true);
              try {
                await submit({
                  data: {
                    contact_email: String(form.get("contact_email") ?? ""),
                    audience_description: String(form.get("audience_description") ?? ""),
                    primary_channel: String(form.get("primary_channel") ?? ""),
                    channel_url: String(form.get("channel_url") ?? ""),
                    audience_size: Number(form.get("audience_size") ?? 0),
                    pitch: String(form.get("pitch") ?? ""),
                  },
                });
                setSent(true);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not submit.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Contact email">
              <input name="contact_email" type="email" required className="input" />
            </Field>
            <Field label="Primary channel">
              <select name="primary_channel" className="input" required>
                {CHANNELS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Channel URL">
              <input name="channel_url" type="url" placeholder="https://" className="input" />
            </Field>
            <Field label="Audience size">
              <input name="audience_size" type="number" min={0} className="input" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Who is your audience? (20–1000 characters)">
                <textarea
                  name="audience_description"
                  required
                  minLength={20}
                  maxLength={1000}
                  rows={3}
                  className="input"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="How would you use Driftly with them? (optional)">
                <textarea name="pitch" maxLength={1000} rows={2} className="input" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <button type="button"
                disabled={busy}
                className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Sending…" : "Submit application"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function Illustration({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="num text-3xl font-semibold text-positive">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-xs">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
