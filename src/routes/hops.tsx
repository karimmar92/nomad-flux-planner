import { createFileRoute, Link } from "@tanstack/react-router";
import { HopsPlanner } from "@/components/hops/HopsPlanner";
import { LegalFooter } from "@/components/LegalFooter";
import { APP_NAME } from "@/lib/app";

export const Route = createFileRoute("/hops")({
  head: () => ({
    meta: [
      { title: `Multi-city flight planner | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Plan a multi-city route with the airports named: cross-airport changes, buffers, cost ranges and stay lengths that suit a two to eight week base.",
      },
      { property: "og:title", content: "Multi-city planner that never hides the airport change" },
      {
        property: "og:description",
        content:
          "BKK is not DMK and LHR is not LGW. Rank multi-city routes by cost, transfers and how well the stays fit remote work.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HopsPage,
});

function HopsPage() {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-xs">Plan</p>
          <h1 className="text-2xl font-semibold tracking-tight">Multi-city hops</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Order your stops, say roughly how long you want in each, and get routes ranked by
            cost, travel time and how workable the stay lengths are. Airports are never collapsed
            into their city — if a route lands you at Don Mueang and flies you out of
            Suvarnabhumi, you will see it here rather than at the taxi rank.
          </p>
        </div>
        <Link to="/tracker" className="text-xs text-muted-foreground hover:text-foreground">
          Back to tracker
        </Link>
      </header>

      <HopsPlanner />
      <LegalFooter />
    </div>
  );
}
