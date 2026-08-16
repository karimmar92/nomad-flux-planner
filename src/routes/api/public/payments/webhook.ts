/**
 * Stripe webhook endpoint.
 *
 * The path is fixed: /api/public/* is the only prefix the platform proxy lets
 * through unauthenticated. Anywhere else, Stripe gets a 403, retries for three
 * days, then drops the event — and subscription state drifts silently.
 *
 * Public route, no session auth (Stripe never sends one). Security is the
 * signature check in verifyWebhook, which runs over the RAW body before the
 * payload is parsed or trusted.
 *
 * The ?env= parameter tells us which signing secret and environment this
 * delivery belongs to; sandbox and live share this handler and the same table.
 */
import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhook, type StripeEnv } from "@/lib/stripe.server";
import { handleStripeEvent } from "@/lib/billing/webhook-handler";

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook received with invalid env parameter:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;

        try {
          const event = await verifyWebhook(request, env);
          return await handleStripeEvent(event, env);
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
