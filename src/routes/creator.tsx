import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { APP_NAME } from "@/lib/app";
import { useSession } from "@/lib/use-session";
import { getCreatorDashboard } from "@/lib/referrals/creator.functions";
import { formatUsd, CREATOR_PROGRAM } from "@/lib/referrals/config";
import { pct } from "@/lib/referrals/commission";
import { ReferralLinkCard } from "@/components/referrals/ReferralLinkCard";
import { Stat } from "@/components/Primitives";

export const Route = createFileRoute("/creator")({
  head: () => ({
    meta: [
      { title: `Creator dashboard | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Your referral link, commission balance, funnel and payout history for the Driftly creator program.",
      },
      { property: "og:title", content: `Creator dashboard | ${APP_NAME}` },
      {
        property: "og:description",
        content: "Track referred subscribers, cleared commission and payouts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CreatorPage,
});

function CreatorPage() {
  const { signedIn, ready } = useSession();
  const fetchDashboard = useServerFn(getCreatorDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["creator-dashboard"],
    queryFn: () => fetchDashboard({}),
    enabled: signedIn,
  });

  if (!ready) return null;

  if (!signedIn) {
    return (
      <Gate title="Creator dashboard">
        <Link to="/auth" search={{ next: "/creator" }} className="underline">
          Sign in
        </Link>{" "}
        to see your dashboard.
      </Gate>
    );
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!data?.isCreator) {
    return (
      <Gate title="Creator dashboard">
        {data?.applicationStatus === "pending" ? (
          <>Your application is in review. We'll email you when it's decided.</>
        ) : data?.applicationStatus === "rejected" ? (
          <>
            Your application wasn't approved this time. You can still use the{" "}
            <Link to="/profile" className="underline">
              free-month referral programme
            </Link>
            .
          </>
        ) : (
          <>
            The creator programme is application-gated.{" "}
            <Link to="/creators" className="underline">
              Read the terms and apply
            </Link>
            .
          </>
        )}
      </Gate>
    );
  }

  const { balance, funnel, cohorts } = data;
  const emptyState = funnel.signups === 0 && balance.lifetimeEarnedCents === 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Creator dashboard</h1>
        <Link to="/creator-terms" className="text-xs text-muted-foreground hover:text-foreground">
          Programme terms
        </Link>
      </header>

      {/* Active referred subscribers is the number that predicts income — lead with it. */}
      <section className="panel grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1 sm:order-1">
          <Stat
            label="Active referred subscribers"
            value={data.activeSubscribers}
            size="lg"
            tone="positive"
            hint={`≈ ${formatUsd(Math.round(data.activeSubscribers * 900))}/mo at current mix`}
          />
        </div>
        <Stat
          label="Available balance"
          value={formatUsd(balance.availableCents)}
          tone={balance.isNegative ? "negative" : "default"}
          hint={
            balance.payoutEligible
              ? "Included in the next monthly batch"
              : `Minimum payout ${formatUsd(CREATOR_PROGRAM.minPayoutCents)}`
          }
        />
        <Stat
          label="Pending"
          value={formatUsd(balance.pendingCents)}
          hint={
            balance.nextClearsInDays === null
              ? `Clears ${CREATOR_PROGRAM.holdDays} days after each payment`
              : `Clears in ${balance.nextClearsInDays} days`
          }
        />
        <Stat label="Lifetime earned" value={formatUsd(balance.lifetimeEarnedCents)} />
      </section>

      <ReferralLinkCard
        code={data.code!}
        note={`${Math.round(CREATOR_PROGRAM.revenueShare * 100)}% of subscription revenue, recurring for up to ${CREATOR_PROGRAM.capMonthsPerReferredUser} months per referred user`}
      />

      {emptyState ? (
        <section className="panel space-y-2 p-4">
          <h2 className="text-sm font-semibold">What works</h2>
          <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            <li>A concrete number beats a feature list — "Lisbon vs Tbilisi, same income".</li>
            <li>Visa-deadline content converts best: people act when a clock is running.</li>
            <li>The QR code above works well at coworking talks and meetups.</li>
            <li>Don't post to coupon or deal aggregators — that breaks the terms.</li>
          </ul>
        </section>
      ) : (
        <>
          <section className="panel space-y-3 p-4">
            <h2 className="label-xs">Funnel</h2>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Clicks" value={funnel.clicks} size="sm" />
              <Stat
                label="Signups"
                value={funnel.signups}
                size="sm"
                hint={pct(funnel.signupRate)}
              />
              <Stat
                label="Pro conversions"
                value={funnel.conversions}
                size="sm"
                hint={pct(funnel.conversionRate)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Click → paid: {pct(funnel.clickToPaidRate)}
            </p>
          </section>

          <section className="panel overflow-x-auto p-4">
            <h2 className="label-xs mb-2">Monthly cohorts</h2>
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr className="text-left">
                  <th className="py-1 font-normal">Month</th>
                  <th className="py-1 text-right font-normal">New</th>
                  <th className="py-1 text-right font-normal">Conv.</th>
                  <th className="py-1 text-right font-normal">Accrued</th>
                  <th className="py-1 text-right font-normal">Cleared</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={c.month} className="border-t border-border">
                    <td className="num py-1.5">{c.month}</td>
                    <td className="num py-1.5 text-right">{c.newReferrals}</td>
                    <td className="num py-1.5 text-right">{c.conversions}</td>
                    <td className="num py-1.5 text-right">{formatUsd(c.accruedCents)}</td>
                    <td className="num py-1.5 text-right">{formatUsd(c.clearedCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel space-y-1 p-4">
            <h2 className="label-xs">Referral quality</h2>
            <p className="num text-2xl font-semibold">
              {data.retention60.creator === null ? "—" : pct(data.retention60.creator, 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              60-day retention of the people you referred
              {data.retention60.platform !== null
                ? `, against a platform average of ${pct(data.retention60.platform, 0)}`
                : ". We'll show the platform average alongside once you have 60 days of referrals"}
              . High retention means your audience is the right fit — it's the healthiest signal
              you can send us.
            </p>
          </section>
        </>
      )}

      <section className="panel p-4">
        <h2 className="label-xs mb-2">Payout history</h2>
        {data.payouts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No payouts yet. Monthly batch via {CREATOR_PROGRAM.payoutRail}, minimum{" "}
            {formatUsd(CREATOR_PROGRAM.minPayoutCents)}.
          </p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {data.payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span className="num text-muted-foreground">{p.created_at.slice(0, 10)}</span>
                <span className="num font-medium">{formatUsd(p.amount_cents)}</span>
                <span className="text-xs text-muted-foreground">{p.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Commission on subscriptions only. Refunds and disputes are clawed back; if the money was
        already paid out, the negative balance nets against your next payout. Full detail in the{" "}
        <Link to="/creator-terms" className="underline">
          programme terms
        </Link>
        .
      </p>
    </div>
  );
}

function Gate({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="panel p-4 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
