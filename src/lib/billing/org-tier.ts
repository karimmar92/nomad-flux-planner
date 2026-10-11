/**
 * Records the purchased business tier and seat count on the organisation.
 *
 * Stripe entitles the BUYER as "teams" whichever tier they chose, so the tier
 * itself has to be stored somewhere the dashboard can read. organisations.plan
 * and seats_purchased are exactly that, and a database trigger
 * (guard_organisation_billing_columns) stops any client writing them, so this
 * runs with the service role from the webhook and the return-path verifier.
 *
 * It never throws into the payment path. A failure here must not turn a
 * successful charge into a 500 that makes Stripe retry for three days; the
 * profile entitlement has already been written by then, and the next
 * subscription event repeats this write.
 */
import {
  MAXIMUM_SEATS,
  MINIMUM_SEATS,
  tierFromPriceKey,
  type OrgPlan,
} from "@/config/business-plans";

export type OrgTierPatch = { plan: OrgPlan; seats_purchased?: number };

/**
 * What to write for a billing event, or null when the event is not a Teams
 * purchase. `entitled` false (cancelled, unpaid) drops the org back to unpaid.
 */
export function orgTierPatch(
  priceKey: string | null | undefined,
  entitled: boolean,
  quantity?: number | null,
): OrgTierPatch | null {
  const tier = tierFromPriceKey(priceKey);
  if (!tier) return null;
  if (!entitled) return { plan: "unpaid" };
  const patch: OrgTierPatch = { plan: tier };
  if (typeof quantity === "number" && Number.isFinite(quantity)) {
    patch.seats_purchased = Math.min(MAXIMUM_SEATS, Math.max(MINIMUM_SEATS, Math.round(quantity)));
  }
  return patch;
}

/** Just enough of the service-role client for these two queries. */
type Query = {
  select: (cols: string) => Query;
  eq: (col: string, value: string) => Query;
  order: (col: string, opts: { ascending: boolean }) => Query;
  limit: (n: number) => Query;
  maybeSingle: () => PromiseLike<{ data: unknown }>;
  update: (patch: OrgTierPatch) => { eq: (col: string, value: string) => PromiseLike<unknown> };
};
type AdminClient = { from: (table: string) => unknown };

export async function syncOrgTier(
  admin: AdminClient,
  userId: string,
  priceKey: string | null | undefined,
  entitled: boolean,
  quantity?: number | null,
): Promise<void> {
  const patch = orgTierPatch(priceKey, entitled, quantity);
  if (!patch) return;
  try {
    const { data: member } = await (admin.from("org_members") as Query)
      .select("org_id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .eq("status", "active")
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const orgId = (member as { org_id?: string } | null)?.org_id;
    if (!orgId) return;
    await (admin.from("organisations") as Query).update(patch).eq("id", orgId);
  } catch {
    // Deliberately swallowed; see the header.
  }
}
