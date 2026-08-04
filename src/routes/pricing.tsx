import { createFileRoute } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/app";
import { useProfile } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: `Pricing | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Free covers 8 cities and a single-country day counter. Pro at $9/mo unlocks every city, full arbitrage, compare and the Schengen engine.",
      },
      { property: "og:title", content: `Pricing | ${APP_NAME}` },
      {
        property: "og:description",
        content: "Free for the basics. Pro at $9/mo for every city and the full Schengen engine.",
      },
    ],
  }),
  component: Pricing,
});

const FREE = [
  { ok: true, text: "8 cities" },
  { ok: true, text: "Basic cost data" },
  { ok: true, text: "Single-country day counter" },
  { ok: false, text: "Personalised arbitrage across every city" },
  { ok: false, text: "Compare" },
  { ok: false, text: "Full Schengen 90/180 engine with alerts" },
  { ok: false, text: "Unlimited trips" },
  { ok: false, text: "Data export" },
];

const PRO = [
  "Every city in the dataset",
  "Personalised arbitrage across every city",
  "Side-by-side compare, 2–4 cities",
  "Full rolling Schengen engine with 75% and 90% alerts",
  "Unlimited trips and timeline history",
  "Data export",
];

function Pricing() {
  const { profile } = useProfile();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Pricing</h1>
        <p className="text-sm text-muted-foreground">
          You&apos;re on the{" "}
          <span className="font-medium capitalize text-foreground">{profile.plan}</span> plan.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel p-5">
          <h2 className="text-sm font-semibold">Free</h2>
          <div className="num mt-1 text-3xl font-semibold">$0</div>
          <ul className="mt-4 space-y-2 text-sm">
            {FREE.map((f) => (
              <li key={f.text} className="flex items-start gap-2">
                {f.ok ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" />
                ) : (
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className={cn(!f.ok && "text-muted-foreground")}>{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel border-primary/50 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Pro</h2>
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
              Recommended
            </span>
          </div>
          <div className="num mt-1 text-3xl font-semibold">
            $9<span className="text-base font-normal text-muted-foreground">/mo</span>
          </div>
          <p className="text-xs text-muted-foreground">or $69/yr — two months free</p>
          <ul className="mt-4 space-y-2 text-sm">
            {PRO.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => toast("Checkout is coming soon", { description: "Payments aren't wired up yet." })}
              className="flex-1 rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground"
            >
              Go Pro — $9/mo
            </button>
            <button
              onClick={() => toast("Checkout is coming soon", { description: "Payments aren't wired up yet." })}
              className="flex-1 rounded-md border border-border py-2.5 text-sm font-medium"
            >
              $69/yr
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
