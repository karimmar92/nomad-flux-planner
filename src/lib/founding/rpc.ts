/**
 * Typed wrappers for the founding-100 database functions.
 *
 * WHY THIS FILE EXISTS AND WHEN TO DELETE IT
 *
 * `founding_spots_taken` and `claim_founding_spot` are created by
 * 20260816120000_founding_members.sql, which has not been applied yet, so
 * they are absent from src/integrations/supabase/types.ts and TypeScript
 * rejects the call by name.
 *
 * The cast is confined to this file rather than sprinkled across three call
 * sites, so that after the migration is applied and types are regenerated
 * there is exactly one place to clean up. The repo already carries the same
 * debt in src/lib/plans/plans.ts, and that one spread because nobody
 * centralised it.
 *
 * The return types below are asserted, not inferred, so they are a promise
 * this file makes rather than a guarantee the compiler checks. They match
 * the SQL: `returns int` and `returns int` (nullable when sold out). If the
 * migration changes, change these in the same commit.
 *
 * TO REMOVE: apply the migration, regenerate types, then replace the bodies
 * with direct `client.rpc(...)` calls and delete the casts.
 */

/**
 * Minimal shape we need, so this works with both the anon and admin clients.
 *
 * The parameter type is `unknown` and the cast happens inside. A generated
 * Supabase client types `rpc` as a union of the function names it knows
 * about, and ours are not in that union yet, so a structural parameter type
 * would be rejected at every call site. Doing it here means one unsafe line
 * instead of three.
 */
type RpcCapable = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

function asRpc(client: unknown): RpcCapable {
  return client as RpcCapable;
}

/**
 * How many of the 100 spots are gone.
 *
 * Returns null when the call fails, deliberately: the UI must be able to tell
 * "nobody has bought one" (0) apart from "we could not find out" (null), and
 * rendering an invented scarcity number is the one outcome worth avoiding.
 */
export async function fetchFoundingTaken(client: unknown): Promise<number | null> {
  const { data, error } = await asRpc(client).rpc("founding_spots_taken");
  if (error || typeof data !== "number") return null;
  return data;
}

/**
 * Claim a spot for a paid checkout session. SERVICE ROLE ONLY.
 *
 * Returns the assigned number, or null if the cohort filled up between the
 * customer opening checkout and paying. A null here means somebody has been
 * charged for something that no longer exists and is owed a refund, so the
 * caller must treat it as an incident rather than a no-op.
 *
 * Safe to call twice with the same payment id: the function keys on it and
 * returns the number already issued.
 */
export async function claimFoundingSpot(
  admin: unknown,
  userId: string,
  paymentId: string,
): Promise<{ spot: number | null; error: string | null }> {
  const { data, error } = await asRpc(admin).rpc("claim_founding_spot", {
    p_user_id: userId,
    p_payment_id: paymentId,
  });
  if (error) return { spot: null, error: error.message };
  return { spot: typeof data === "number" ? data : null, error: null };
}
