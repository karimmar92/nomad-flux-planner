/**
 * Writes to the Stripe webhook audit log.
 *
 * Same reason for the cast as src/lib/founding/rpc.ts: `webhook_events` is
 * created by 20260816130000_webhook_events.sql, which has not been applied, so
 * the table is absent from the generated Supabase types. Confined here so
 * there is one place to clean up after regenerating them.
 *
 * ── EVERY FUNCTION HERE SWALLOWS ITS ERRORS, ON PURPOSE ───────────────
 *
 * These are called from the webhook handler. If an audit write fails and we
 * let it propagate, the handler returns 500, Stripe retries, and a payment
 * that was already processed correctly gets processed again. A missing log
 * line is annoying. A double-processed payment is a refund conversation.
 *
 * So: logging never changes the outcome of a webhook. If the log is empty
 * when you go looking, that is itself the finding.
 */

type TableCapable = {
  from: (table: string) => {
    upsert: (
      values: Record<string, unknown>,
      opts?: Record<string, unknown>,
    ) => PromiseLike<unknown>;
    update: (values: Record<string, unknown>) => {
      eq: (col: string, val: string) => PromiseLike<unknown>;
    };
  };
};

function asTable(client: unknown): TableCapable {
  return client as TableCapable;
}

/**
 * Record that an event arrived, before doing anything with it.
 *
 * Upsert rather than insert: Stripe retries deliveries, and a retry should
 * update the existing row rather than create a second one. That also means the
 * row survives a handler crash, which is exactly the case you want evidence
 * for.
 */
export async function logWebhookReceived(
  admin: unknown,
  args: { eventId: string; type: string; userId: string | null; payload: unknown },
): Promise<void> {
  try {
    await asTable(admin).from("webhook_events").upsert(
      {
        stripe_event_id: args.eventId,
        type: args.type,
        status: "received",
        user_id: args.userId,
        payload: args.payload,
      },
      { onConflict: "stripe_event_id" },
    );
  } catch {
    // Deliberately ignored. See the file header.
  }
}

/** Record what the handler decided. */
export async function logWebhookOutcome(
  admin: unknown,
  args: {
    eventId: string;
    userId: string | null;
    outcome: Record<string, unknown>;
    failed: boolean;
  },
): Promise<void> {
  const status = args.failed ? "error" : args.outcome["skipped"] ? "skipped" : "processed";
  try {
    await asTable(admin)
      .from("webhook_events")
      .update({
        status,
        result: args.outcome,
        error: args.failed ? String(args.outcome["error"] ?? "unknown") : null,
        processed_at: new Date().toISOString(),
        user_id: args.userId,
      })
      .eq("stripe_event_id", args.eventId);
  } catch {
    // Deliberately ignored. See the file header.
  }
}
