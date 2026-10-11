/**
 * Creating an organisation and its first admin.
 *
 * This runs with the service-role client on purpose. Through the caller's own
 * client it cannot succeed under the database rules, for two separate reasons
 * that both only show up the first time anyone tries it:
 *
 *   1. `insert(...).select()` asks Postgres to RETURN the new row, and a
 *      returned row must pass the SELECT policy. That policy only lets members
 *      read their organisation, and the creator is not a member yet.
 *   2. The first admin row cannot be inserted by the user either: the insert
 *      policy requires the caller to ALREADY be an admin of that organisation.
 *
 * So the caller must be authenticated (the server function guarantees it), the
 * organisation is created for that caller and no one else, and the plan and
 * seat count are left at their defaults. Those two columns are billing-controlled:
 * the paid values are written from Stripe events, never from the form.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function createOrganisationFor(
  admin: SupabaseClient<Database>,
  userId: string,
  input: { name: string; billing_email: string },
): Promise<{ org_id: string }> {
  // One organisation per person. The dashboard resolves "your organisation"
  // from a single membership row, and two would make every read ambiguous.
  const { data: existing } = await admin
    .from("org_members")
    .select("id")
    .eq("user_id", userId)
    .neq("status", "left")
    .limit(1)
    .maybeSingle();
  if (existing) {
    throw new Error("You already belong to an organisation. Leave it first to start another.");
  }

  // Generated here so no row has to be read back after the insert.
  const orgId = crypto.randomUUID();
  const { error: orgError } = await admin
    .from("organisations")
    .insert({ id: orgId, name: input.name, billing_email: input.billing_email });
  if (orgError) throw new Error(orgError.message);

  const { error: memberError } = await admin.from("org_members").insert({
    org_id: orgId,
    user_id: userId,
    role: "admin",
    status: "active",
    joined_at: new Date().toISOString(),
  });
  if (memberError) {
    // Never leave an organisation nobody can administer.
    await admin.from("organisations").delete().eq("id", orgId);
    throw new Error(memberError.message);
  }

  return { org_id: orgId };
}
