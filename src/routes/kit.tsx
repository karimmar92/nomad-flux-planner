import { createFileRoute } from "@tanstack/react-router";
import { PartnerGroup } from "@/components/partners/PartnerCard";
import { APP_NAME } from "@/lib/app";

export const Route = createFileRoute("/kit")({
  head: () => ({
    meta: [
      { title: `Nomad kit — eSIM and insurance | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Our editorial comparison of nomad eSIMs and health cover, with the caveats that actually matter. Affiliate links, clearly labelled.",
      },
      { property: "og:title", content: `Nomad kit — eSIM and insurance | ${APP_NAME}` },
      {
        property: "og:description",
        content: "eSIM and insurance options compared with our own notes, not the partners'.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KitPage,
});

function KitPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Nomad kit</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Two things you need before almost any trip: data on arrival, and cover while you&apos;re
          there. The notes below are ours — partners do not get to write them, and none of this
          affects how cities are ranked anywhere else in {APP_NAME}.
        </p>
      </header>

      <section className="panel space-y-5 p-4">
        <PartnerGroup category="esim" placement="kit_page" title="eSIM — data on landing" />
        <PartnerGroup category="insurance" placement="kit_page" title="Health cover" />
      </section>
    </div>
  );
}
