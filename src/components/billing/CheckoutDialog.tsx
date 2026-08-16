/**
 * Embedded checkout.
 *
 * The payment form renders inside the app rather than sending people to an
 * external page: the checkout is the moment trust is thinnest, and a sudden
 * redirect to an unfamiliar domain is where people abandon.
 *
 * The provider is mounted with a STABLE options object. Recreating it on each
 * render remounts the provider and Stripe throws "you cannot change the client
 * secret after creation", which breaks the form after the first keystroke.
 */
import { useCallback, useMemo, useRef } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/lib/billing/billing.functions";
import type { BillingInterval, PaidPlanId } from "@/config/stripe-prices";

export type CheckoutRequest = { plan: PaidPlanId; interval: BillingInterval };

export function CheckoutDialog({
  request,
  onClose,
}: {
  request: CheckoutRequest;
  onClose: () => void;
}) {
  const createSession = useServerFn(createCheckoutSession);
  const createSessionRef = useRef(createSession);
  createSessionRef.current = createSession;
  const requestRef = useRef(request);
  const sessionPromiseRef = useRef<Promise<string> | null>(null);

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    // Stripe may ask for the secret more than once while its iframe initializes.
    // Reuse one in-flight request so retries cannot create duplicate sessions.
    if (!sessionPromiseRef.current) {
      const selected = requestRef.current;
      sessionPromiseRef.current = createSessionRef.current({
        data: {
          plan: selected.plan,
          interval: selected.interval,
          environment: getStripeEnvironment(),
          // Stripe substitutes the session id server-side before returning here.
          returnUrl: `${window.location.origin}/profile?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        },
      }).then((result) => {
        if ("error" in result) throw new Error(result.error);
        if (!result.clientSecret) throw new Error("Checkout could not be started.");
        return result.clientSecret;
      });
    }
    return sessionPromiseRef.current;
  }, []);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Checkout"
    >
      <div className="relative my-8 w-full max-w-lg rounded-xl bg-background p-2 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute end-3 top-3 z-10 rounded-full bg-background/90 p-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Close checkout"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
        <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    </div>
  );
}
