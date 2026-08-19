/**
 * THE PAYWALL, TRIGGERED AT INTENT.
 *
 * Rules this component exists to enforce:
 *
 *   1. It NEVER opens on page load, on navigation, or on a timer. It opens
 *      when someone reaches for a paid answer and only then. An interstitial
 *      shown to someone who has not yet asked for anything is an ad.
 *   2. VALUE FIRST. The outcome and what they get render above the fold of
 *      the sheet; the price is below it, once.
 *   3. ANNUAL IS THE DEFAULT and is anchored against the monthly figure it
 *      replaces, with a derived "Save XX%" badge.
 *   4. ONE CTA. A single button starts the trial. Everything else — monthly,
 *      the founding one-off, the full table — is a text link, not a button.
 *
 * State lives here rather than in each page so a second trigger cannot stack
 * two sheets, and so the meter and the sheet agree on what has been spent.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, Lock, X } from "lucide-react";
import { toast } from "sonner";
import type { ProFeature } from "@/lib/entitlements";
import { featureLabel, paywallCopy } from "@/lib/paywall/value";
import { track } from "@/lib/analytics/funnel";
import {
  FREE_MONTHLY_CHECKS,
  isMetered,
  readMeter,
  remaining,
  spend,
  writeMeter,
  type MeterState,
} from "@/lib/paywall/meter";
import {
  TRIAL_DAYS,
  annualMonthlyEquivalentUsd,
  annualSavingPercent,
  annualUsd,
  tier,
} from "@/config/pricing";
import { FOUNDING_PRICE_USD } from "@/config/founding";
import { getStripeEnvironment } from "@/lib/stripe";
import { CheckoutDialog, type CheckoutRequest } from "@/components/billing/CheckoutDialog";
import { pricingNextUrl, writePurchaseIntent } from "@/lib/billing/purchase-intent";
import { resolveSignedIn, useSession } from "@/lib/use-session";
import { cn } from "@/lib/utils";

type OpenArgs = {
  feature: ProFeature | null;
  /** Why the wall appeared — changes one line of copy, nothing else. */
  reason?: "hard" | "meter_exhausted";
};

type PaywallContextValue = {
  open: (args: OpenArgs) => void;
  meter: MeterState;
  /** Spends a metered check. Returns false and opens the wall when exhausted. */
  spendCheck: (feature: ProFeature) => boolean;
};

const PaywallContext = createContext<PaywallContextValue | null>(null);

export function usePaywall(): PaywallContextValue {
  const ctx = useContext(PaywallContext);
  if (!ctx) {
    // A gate outside the provider must degrade to "locked", never crash a page.
    return {
      open: () => {},
      meter: { period: "", spent: [] },
      spendCheck: () => false,
    };
  }
  return ctx;
}

export function PaywallProvider({ children }: { children: ReactNode }) {
  const [args, setArgs] = useState<OpenArgs | null>(null);
  const [meter, setMeter] = useState<MeterState>({ period: "", spent: [] });

  // Read after mount: localStorage in a state initialiser mismatches hydration.
  useEffect(() => setMeter(readMeter()), []);

  const open = useCallback((next: OpenArgs) => {
    track("paywall_intent", {
      feature: next.feature,
      reason: next.reason ?? "hard",
      checksLeft: remaining(readMeter()),
    });
    setArgs(next);
  }, []);

  const spendCheck = useCallback(
    (feature: ProFeature): boolean => {
      if (!isMetered(feature)) {
        setArgs({ feature, reason: "hard" });
        return false;
      }
      const current = readMeter();
      const result = spend(current, feature);
      if (!result.granted) {
        setMeter(current);
        setArgs({ feature, reason: "meter_exhausted" });
        return false;
      }
      writeMeter(result.state);
      setMeter(result.state);
      return true;
    },
    [],
  );

  const value = useMemo(() => ({ open, meter, spendCheck }), [open, meter, spendCheck]);

  return (
    <PaywallContext.Provider value={value}>
      {children}
      {args ? (
        <PaywallSheet args={args} meter={meter} onClose={() => setArgs(null)} />
      ) : null}
    </PaywallContext.Provider>
  );
}

function PaywallSheet({
  args,
  meter,
  onClose,
}: {
  args: OpenArgs;
  meter: MeterState;
  onClose: () => void;
}) {
  const copy = paywallCopy(args.feature);
  const navigate = useNavigate();
  const { ready, signedIn } = useSession();
  const [interval, setInterval] = useState<"yearly" | "monthly">("yearly");
  const [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutRequest | null>(null);

  const pro = tier("pro");
  const yearly = annualUsd(pro);
  const perMonthOnAnnual = annualMonthlyEquivalentUsd(pro);
  const saving = annualSavingPercent();

  const start = () => {
    try {
      getStripeEnvironment();
    } catch (e) {
      toast("Checkout is not available", {
        description: e instanceof Error ? e.message : undefined,
      });
      return;
    }
    setBusy(true);
    track("trial_start", { feature: args.feature, reason: interval });
    void (async () => {
      const authed = ready ? signedIn : await resolveSignedIn();
      if (!authed) {
        setBusy(false);
        writePurchaseIntent({ plan: "pro", interval });
        void navigate({
          to: "/auth",
          search: {
            next: pricingNextUrl({
              plan: "pro",
              interval,
            }),
          },
        });
        return;
      }
      setCheckout({ plan: "pro", interval });
    })();
  };

  if (checkout) {
    return (
      <CheckoutDialog
        request={checkout}
        onClose={() => {
          setCheckout(null);
          setBusy(false);
          onClose();
        }}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-outcome"
    >
      <div className="relative w-full max-w-md rounded-t-2xl border border-border bg-background p-5 shadow-xl sm:rounded-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute end-3 top-3 rounded-full p-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        {/* ── VALUE ─────────────────────────────────────────────────── */}
        <p className="label-xs flex items-center gap-1.5 text-muted-foreground">
          <Lock className="h-3 w-3" aria-hidden />
          {args.reason === "meter_exhausted"
            ? `You have used your ${FREE_MONTHLY_CHECKS} free checks this month`
            : "Pro feature"}
        </p>

        <h2 id="paywall-outcome" className="mt-2 text-lg font-semibold leading-snug">
          {copy.outcome}
        </h2>

        <ul className="mt-4 space-y-2">
          {copy.gets.map((g) => (
            <li key={g} className="flex items-start gap-2 text-sm leading-relaxed">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>{g}</span>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{copy.limit}</p>

        {/* ── WHAT YOU ALREADY USED, AND WHAT COMES NEXT ─────────────
            Naming the free value already delivered is the most honest upsell
            available: it is a receipt, not a claim. The "next" line then says
            what the same click buys from here on. */}
        <div className="mt-4 rounded-xl border border-dashed border-border p-3 text-xs leading-relaxed">
          {meter.spent.length > 0 ? (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">
                Used this month: {meter.spent.length} of {FREE_MONTHLY_CHECKS} free checks
              </span>{" "}
              — {meter.spent.map((f) => featureLabel(f)).join(", ")}.
            </p>
          ) : (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">
                {FREE_MONTHLY_CHECKS} free checks a month
              </span>{" "}
              cover a look at the forward-looking tools. The {featureLabel(args.feature)}{" "}
              sits outside them.
            </p>
          )}
          <p className="mt-1.5 text-muted-foreground">
            <span className="font-medium text-foreground">Next:</span> unlimited{" "}
            {featureLabel(args.feature)}, no monthly check counter, and every other Pro
            answer unlocked at the same time.
          </p>
        </div>

        {/* ── PRICE, once, annual first, anchored ───────────────────── */}
        <div className="mt-5 rounded-xl border border-border bg-surface-2 p-4">
          <div className="flex items-center gap-2" role="group" aria-label="Billing period">
            {(["yearly", "monthly"] as const).map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setInterval(i)}
                aria-pressed={interval === i}
                className={cn(
                  "min-h-9 rounded-full px-3 text-xs font-medium",
                  interval === i
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {i === "yearly" ? "Annual" : "Monthly"}
              </button>
            ))}
            <span className="ms-auto rounded-full bg-positive-muted px-2 py-0.5 text-[11px] font-semibold text-positive">
              Save {saving}%
            </span>
          </div>

          {interval === "yearly" ? (
            <p className="num mt-3 text-sm">
              <span className="text-xl font-semibold">${perMonthOnAnnual}</span>
              <span className="text-muted-foreground"> /month</span>
              {/* The anchor: the monthly price this replaces, struck through. */}
              <span className="ms-2 text-muted-foreground line-through">${pro.monthlyUsd}</span>
              <span className="block text-xs text-muted-foreground">
                Billed ${yearly} once a year.
              </span>
            </p>
          ) : (
            <p className="num mt-3 text-sm">
              <span className="text-xl font-semibold">${pro.monthlyUsd}</span>
              <span className="text-muted-foreground"> /month, billed monthly</span>
              <span className="block text-xs text-muted-foreground">
                ${perMonthOnAnnual}/month on annual — save {saving}%.
              </span>
            </p>
          )}
        </div>

        {/* ── ONE CTA ───────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={start}
          disabled={busy}
          className="mt-4 min-h-12 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? "Opening checkout…" : `Start ${TRIAL_DAYS}-day free trial`}
        </button>

        <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
          Card required. Free for {TRIAL_DAYS} days, then $
          {interval === "yearly" ? `${yearly}/year` : `${pro.monthlyUsd}/month`}. Cancel any time
          before then and you are not charged.
        </p>

        <button
          type="button"
          onClick={() => {
            onClose();
            void navigate({ to: "/pricing", hash: "founding" });
          }}
          className="mt-3 w-full text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Or pay ${FOUNDING_PRICE_USD} once, no subscription — see all plans
        </button>
      </div>
    </div>
  );
}
