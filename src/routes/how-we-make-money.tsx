import { createFileRoute, Link } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/app";
import { PARTNERS } from "@/config/partners";

export const Route = createFileRoute("/how-we-make-money")({
  head: () => ({
    meta: [
      { title: `How we make money | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Subscriptions first, affiliate commissions second. Commissions never affect city rankings, cost data or the editorial notes.",
      },
      { property: "og:title", content: `How we make money | ${APP_NAME}` },
      {
        property: "og:description",
        content: "Plain explanation of our revenue and the firewall between it and our rankings.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HowWeMakeMoney,
});

function HowWeMakeMoney() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">How we make money</h1>

      <section className="panel space-y-3 p-4 text-sm leading-relaxed text-foreground/90">
        <p>
          <strong>Subscriptions are the primary revenue.</strong> {APP_NAME} Pro is what pays for
          the data verification, the visa research and the engineering. If the product is useful,
          people pay for it — that is the whole business model.
        </p>
        <p>
          <strong>Affiliate commissions are secondary.</strong> When you buy an eSIM, an insurance
          policy or a ticket through a link here, we may earn a commission at no extra cost to you.
          Every such link carries a visible disclosure directly beneath it.
        </p>
        <p>
          <strong>Transport links follow a stricter rule.</strong> An eSIM is destination-agnostic
          — which one you need depends on where you already decided to go. Transport is not: it
          would pay us for you to move more often, and moving less is usually cheaper, calmer and
          better for your work and your tax position. So transport links appear only where a move
          is already decided or already forced by a visa deadline: the border-run planner, a trip
          you have just saved, and the Nomad kit reference list. Never on Explore, never as a
          route suggestion, and never in a notification. No fare alerts, ever.
        </p>
        <p>
          <strong>Commissions never affect city rankings or cost data.</strong> Explore ordering,
          the Compare table, the arbitrage calculator, the border-run ranking and every city score
          are computed only from
          your income, your filters and our seed data. Those modules are structurally
          partner-free: no affiliate link may be rendered in them, and every affiliate URL in the
          app lives in one config file so this is verifiable rather than promised.
        </p>
        <p>
          <strong>The editorial notes are ours.</strong> Partners do not review, approve or write
          them, which is why some of them are unflattering.
        </p>
        <p>
          <strong>No ads.</strong> No banners, no interstitials, no third-party ad network, ever.
        </p>
      </section>

      <section className="panel p-4">
        <h2 className="mb-2 text-sm font-semibold">Current partners</h2>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {PARTNERS.map((p) => (
            <li key={p.id}>
              <span className="text-foreground">{p.name}</span> — {p.category}
            </li>
          ))}
        </ul>
        <Link to="/kit" className="mt-3 inline-block text-xs text-primary underline">
          See the nomad kit comparison
        </Link>
      </section>
    </div>
  );
}
