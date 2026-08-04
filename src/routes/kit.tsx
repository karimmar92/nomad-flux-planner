import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { PartnerGroup } from "@/components/partners/PartnerCard";
import { TransportGroup } from "@/components/partners/TransportGroup";
import { BankingGroup } from "@/components/partners/BankingGroup";

import { APP_NAME } from "@/lib/app";
import { RequiresNetwork } from "@/components/OfflineBanner";

export const Route = createFileRoute("/kit")({
  head: () => ({
    meta: [
      { title: `Nomad kit — eSIM, cover, transport and money | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Our editorial comparison of nomad eSIMs, health cover, transport and multi-currency accounts, with the caveats that actually matter. Affiliate links, clearly labelled.",
      },
      { property: "og:title", content: `Nomad kit — eSIM, cover and money | ${APP_NAME}` },
      {
        property: "og:description",
        content:
          "eSIM, insurance, transport and multi-currency accounts compared with our own notes, not the partners'.",
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

      {/* Partner links are outbound purchases: disabled, with a reason, offline. */}
      <RequiresNetwork reason="Offline — partner links open once you're back online. Buy your eSIM before you fly.">
        <PartnerGroup
          category="esim"
          placement="kit_page"
          title="Connectivity"
          variant="row"
        />
      </RequiresNetwork>

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

      <div className="space-y-3">
        {/* Reference list, not a prompt: no origin, no dates, no fares. */}
        <TransportGroup placement="kit_page" variant="row" title="Getting there" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Listed for when you already know you&apos;re moving. We never suggest a journey you
          weren&apos;t going to make — no route ideas on Explore, no fare alerts.
        </p>
      </div>

      {/*
        Money. Deliberately its own section, far from anything about tax
        residency: banking beside a residency trigger reads as tax structuring
        advice. Multi-currency accounts only — never local account opening,
        and never the agencies selling help with it. See the BANKING RULE in
        src/config/partners.ts.
      */}
      <BankingGroup placement="kit_page" title="Money" />

      {/*
        Company formation is NOT listed here as a partner card, even though the
        Nomad kit is the catalogue surface. It pays the most of anything in the
        stack, and a link with no context is exactly how people end up in a
        $25,000 Form 5472 obligation that helps them not at all. The links live
        behind the eligibility tool, which is capable of concluding "don't".
        See the FORMATION RULE in src/config/partners.ts.
      */}
      <section className="space-y-3">
        <h2 className="label-xs font-semibold">Company</h2>
        <Link
          to="/setup/company"
          className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent-positive/40"
        >
          <p className="text-base font-bold leading-tight tracking-tight text-foreground">
            Do you actually need a US LLC?
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Six questions on residency, clients and US presence. For most people with a real tax
            residency the answer is no, and we say so — CFC rules look through the company and tax
            the profit where you live.
          </p>
          <span className="mt-3 inline-block text-sm font-semibold text-accent-positive">
            Run the check
          </span>
        </Link>
      </section>

      <footer className="space-y-2 border-t border-border pt-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          We only earn from eSIM, insurance, transport, multi-currency account and company
          formation links. Commissions never affect city rankings or cost data, transport links
          only appear once a move is already decided or forced by a visa deadline, formation links
          appear only where forming a company is plausibly useful for you, and no other screen in{" "}
          {APP_NAME} shows more than a single link.
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
