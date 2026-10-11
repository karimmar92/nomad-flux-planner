import { describe, expect, it, vi } from "vitest";
import { orgTierPatch, syncOrgTier } from "./org-tier";

describe("orgTierPatch", () => {
  it("records the tier and clamps the seat count to the sellable range", () => {
    expect(orgTierPatch("teams_advanced_yearly", true, 25)).toEqual({
      plan: "advanced",
      seats_purchased: 25,
    });
    expect(orgTierPatch("teams_basic_monthly", true, 2)?.seats_purchased).toBe(10);
    expect(orgTierPatch("teams_pro_monthly", true, 9999)?.seats_purchased).toBe(500);
  });

  it("leaves the seat count alone when the event carries no quantity", () => {
    expect(orgTierPatch("teams_pro_monthly", true)).toEqual({ plan: "pro" });
  });

  it("drops the org to unpaid when the subscription is no longer entitling", () => {
    expect(orgTierPatch("teams_advanced_monthly", false, 25)).toEqual({ plan: "unpaid" });
  });

  it("ignores purchases that are not Teams", () => {
    expect(orgTierPatch("pro_monthly", true, 1)).toBeNull();
    expect(orgTierPatch(null, true)).toBeNull();
  });
});

describe("syncOrgTier", () => {
  function fakeAdmin(orgId: string | null) {
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) });
    const chain: Record<string, unknown> = {};
    for (const k of ["select", "eq", "order", "limit"]) chain[k] = () => chain;
    chain["maybeSingle"] = () => Promise.resolve({ data: orgId ? { org_id: orgId } : null });
    return {
      update,
      client: {
        from: (table: string) => (table === "org_members" ? chain : { update }),
      },
    };
  }

  it("writes the patch to the buyer's organisation", async () => {
    const { client, update } = fakeAdmin("org-1");
    await syncOrgTier(client, "u1", "teams_advanced_yearly", true, 30);
    expect(update).toHaveBeenCalledWith({ plan: "advanced", seats_purchased: 30 });
  });

  it("does nothing when the buyer has no organisation", async () => {
    const { client, update } = fakeAdmin(null);
    await syncOrgTier(client, "u1", "teams_advanced_yearly", true, 30);
    expect(update).not.toHaveBeenCalled();
  });

  it("never throws into the payment path", async () => {
    const client = {
      from: () => {
        throw new Error("db down");
      },
    };
    await expect(syncOrgTier(client, "u1", "teams_pro_monthly", true)).resolves.toBeUndefined();
  });
});
