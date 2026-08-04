import { createFileRoute, Link } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/app";
import { CREATOR_PROGRAM, formatUsd } from "@/lib/referrals/config";

export const Route = createFileRoute("/creator-terms")({
  head: () => ({
    meta: [
      { title: `Creator programme terms | ${APP_NAME}` },
      {
        name: "description",
        content:
          "The full rules of the Driftly creator programme: 30% recurring, 12-month cap, 45-day hold, clawbacks, and what will get you removed.",
      },
      { property: "og:title", content: `Creator programme terms | ${APP_NAME}` },
      {
        property: "og:description",
        content: "Commission, holds, clawbacks and prohibited promotion, stated plainly.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const share = Math.round(CREATOR_PROGRAM.revenueShare * 100);

  return (
    <article className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Creator programme terms</h1>
        <p className="text-xs text-muted-foreground">Version {CREATOR_PROGRAM.termsVersion}</p>
      </header>

      <Section title="What we pay">
        <li>{share}% of subscription revenue we actually collect from users you referred.</li>
        <li>
          Recurring monthly for as long as they stay subscribed, capped at{" "}
          {CREATOR_PROGRAM.capMonthsPerReferredUser} months per referred user.
        </li>
        <li>
          Subscriptions only. eSIM, insurance and other partner revenue is not shared under this
          programme.
        </li>
        <li>Commission accrues when an invoice is paid — not when a subscription is created.</li>
      </Section>

      <Section title="Attribution">
        <li>
          A referral is locked to the user's account at signup and never re-attributed. Someone who
          signs up free through your link and subscribes five months later still credits you.
        </li>
        <li>Last-touch, 30-day window, first-party cookie and local storage.</li>
      </Section>

      <Section title="Holds and payouts">
        <li>
          Accruals become available {CREATOR_PROGRAM.holdDays} days after they are created, which
          clears the refund and dispute window.
        </li>
        <li>Minimum payout {formatUsd(CREATOR_PROGRAM.minPayoutCents)}.</li>
        <li>Monthly batch via {CREATOR_PROGRAM.payoutRail}, which handles tax forms.</li>
        <li>
          Your balance is derived from an append-only ledger. Every credit, clawback, payout and
          adjustment is a separate row we can show you.
        </li>
      </Section>

      <Section title="Clawbacks">
        <li>A refund or chargeback writes a negative row for the same amount.</li>
        <li>
          If the commission had already been paid out, you carry a negative balance that nets
          against your next payout. We would rather say this plainly now than surprise you later.
        </li>
      </Section>

      <Section title="What will get you removed">
        <li>Self-referral, including accounts under another email you control.</li>
        <li>Bidding on the {APP_NAME} brand name, or close variants, in paid search.</li>
        <li>Posting your link to coupon, voucher or deal aggregator sites.</li>
        <li>Misrepresenting what {APP_NAME} does, particularly on visa or tax outcomes.</li>
      </Section>

      <Section title="Review, not automatic rejection">
        <li>
          Unusual patterns — very high conversion rates, sudden volume spikes, many signups from one
          network — queue for a human to look at.
        </li>
        <li>
          Shared IP addresses are never grounds for automatic rejection. Our users work from
          coworking spaces; twenty signups from one café is normal behaviour here.
        </li>
      </Section>

      <p className="text-xs text-muted-foreground">
        The separate{" "}
        <Link to="/profile" className="underline">
          user referral programme
        </Link>{" "}
        pays free months, never cash, and has no application.{" "}
        <Link to="/how-we-make-money" className="underline">
          How we make money
        </Link>
        .
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel space-y-2 p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="list-disc space-y-1 ps-4 text-sm text-muted-foreground">{children}</ul>
    </section>
  );
}
