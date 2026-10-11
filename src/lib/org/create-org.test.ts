import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createOrganisationFor } from "./create-org";

type Row = Record<string, unknown>;

/** Records every write and lets a test decide what each table answers. */
function fakeAdmin(opts: { existingMember?: boolean; memberError?: string; orgError?: string }) {
  const inserts: { table: string; row: Row }[] = [];
  const deletes: { table: string; id: unknown }[] = [];

  const client = {
    from(table: string) {
      const read = {
        select: () => read,
        eq: () => read,
        neq: () => read,
        limit: () => read,
        maybeSingle: () =>
          Promise.resolve({
            data: opts.existingMember && table === "org_members" ? { id: "m" } : null,
          }),
      };
      return {
        ...read,
        insert: (row: Row) => {
          inserts.push({ table, row });
          const message = table === "organisations" ? opts.orgError : opts.memberError;
          return Promise.resolve({ error: message ? { message } : null });
        },
        delete: () => ({
          eq: (_col: string, id: unknown) => {
            deletes.push({ table, id });
            return Promise.resolve({ error: null });
          },
        }),
      };
    },
  };
  return { admin: client as unknown as SupabaseClient<Database>, inserts, deletes };
}

const input = { name: "Northwind Labs", billing_email: "finance@northwind.example" };

describe("createOrganisationFor", () => {
  it("creates the organisation and makes the caller its active admin", async () => {
    const { admin, inserts } = fakeAdmin({});
    const { org_id } = await createOrganisationFor(admin, "user-1", input);

    const org = inserts.find((i) => i.table === "organisations")!.row;
    const member = inserts.find((i) => i.table === "org_members")!.row;
    expect(org["id"]).toBe(org_id);
    expect(member).toMatchObject({ org_id, user_id: "user-1", role: "admin", status: "active" });
  });

  it("never writes the billing-controlled columns from the form", async () => {
    const { admin, inserts } = fakeAdmin({});
    await createOrganisationFor(admin, "user-1", input);
    const org = inserts.find((i) => i.table === "organisations")!.row;
    expect(org).not.toHaveProperty("plan");
    expect(org).not.toHaveProperty("seats_purchased");
  });

  it("refuses a second organisation for someone who already belongs to one", async () => {
    const { admin, inserts } = fakeAdmin({ existingMember: true });
    await expect(createOrganisationFor(admin, "user-1", input)).rejects.toThrow(/already belong/);
    expect(inserts).toHaveLength(0);
  });

  it("removes the organisation again if the admin row cannot be written", async () => {
    const { admin, deletes } = fakeAdmin({ memberError: "boom" });
    await expect(createOrganisationFor(admin, "user-1", input)).rejects.toThrow("boom");
    expect(deletes).toEqual([{ table: "organisations", id: expect.any(String) }]);
  });

  it("surfaces an organisation insert failure without touching members", async () => {
    const { admin, inserts } = fakeAdmin({ orgError: "nope" });
    await expect(createOrganisationFor(admin, "user-1", input)).rejects.toThrow("nope");
    expect(inserts.some((i) => i.table === "org_members")).toBe(false);
  });

  it("uses a fresh id each time", async () => {
    vi.spyOn(crypto, "randomUUID");
    const a = fakeAdmin({});
    const b = fakeAdmin({});
    const first = await createOrganisationFor(a.admin, "u1", input);
    const second = await createOrganisationFor(b.admin, "u2", input);
    expect(first.org_id).not.toBe(second.org_id);
  });
});
