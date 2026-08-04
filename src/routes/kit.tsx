import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
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
  const router = useRouter();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.history.back()}
            aria-label="Go back"
            className="-ml-2 grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold tracking-tight">Nomad kit</h1>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          What we&apos;d take anywhere: data on landing, and cover while you&apos;re there. The
          notes are ours — partners don&apos;t get to write them, and none of this affects how
          cities are ranked anywhere else in {APP_NAME}.
        </p>
      </header>

      <PartnerGroup
        category="esim"
        placement="kit_page"
        title="Connectivity"
        variant="row"
      />

      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-xl border border-accent-warning/30 bg-accent-warning-muted p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-warning" aria-hidden />
          <p className="text-sm leading-relaxed text-foreground">
            Most nomad visas require proof of cover for the full permit duration.
          </p>
        </div>
        <PartnerGroup
          category="insurance"
          placement="kit_page"
          title="Health cover"
          variant="row"
        />
      </div>

      <footer className="space-y-2 border-t border-border pt-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          We only earn from eSIM and insurance links. Commissions never affect city rankings or
          cost data.
        </p>
        <Link
          to="/how-we-make-money"
          className="inline-block text-xs font-semibold text-accent-positive underline-offset-4 hover:underline"
        >
          How we make money
        </Link>
      </footer>
    </div>
  );
}
