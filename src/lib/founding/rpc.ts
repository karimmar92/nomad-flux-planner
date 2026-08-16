import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Typed wrappers for the founding-100 database functions.
 */

/**
 * How many of the 100 spots are gone.
 *
 * Returns null when the call fails, deliberately: the UI must be able to tell
 * "nobody has bought one" (0) apart from "we could not find out" (null), and
 * rendering an invented scarcity number is the one outcome worth avoiding.
 */
export async function fetchFoundingTaken(
  client: SupabaseClient<Database>,
): Promise<number | null> {
  const { data, error } = await client.rpc("founding_spots_taken");
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
  admin: SupabaseClient<Database>,
  userId: string,
  paymentId: string,
): Promise<{ spot: number | null; error: string | null }> {
  const { data, error } = await admin.rpc("claim_founding_spot", {
    p_user_id: userId,
    p_payment_id: paymentId,
  });
  if (error) return { spot: null, error: error.message };
  return { spot: typeof data === "number" ? data : null, error: null };
}
