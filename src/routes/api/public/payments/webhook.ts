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
import { logWebhookOutcome, logWebhookReceived } from "@/lib/billing/webhook-log";

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

          // Audit log. Admin client is loaded here rather than at module scope
          // so the server-only module never enters a client chunk. Every call
          // below swallows its own errors: a missing log line must never turn
          // a processed payment into a 500 and a Stripe retry.
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const userId =
            (event.data.object as { metadata?: Record<string, string> } | undefined)?.metadata?.[
              "userId"
            ] ?? null;
          await logWebhookReceived(supabaseAdmin, {
            eventId: event.id,
            type: event.type,
            userId,
            payload: event as unknown,
          });

          try {
            const response = await handleStripeEvent(event, env);
            let outcome: Record<string, unknown> = {};
            try {
              outcome = (await response.clone().json()) as Record<string, unknown>;
            } catch {
              outcome = { ok: true };
            }
            await logWebhookOutcome(supabaseAdmin, {
              eventId: event.id,
              userId,
              outcome,
              failed: false,
            });
            return response;
          } catch (handlerError) {
            await logWebhookOutcome(supabaseAdmin, {
              eventId: event.id,
              userId,
              outcome: { error: String(handlerError) },
              failed: true,
            });
            throw handlerError;
          }
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});

