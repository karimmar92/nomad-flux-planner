/**
 * Business-tier server functions.
 *
 * Every employer-facing read goes through the `org_member_presence` and
 * `org_member_directory` views. The dashboard never touches `profiles` or
 * `trips` directly — see fields.ts for why the column list is narrow.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EMPLOYER_DIRECTORY_FIELDS, EMPLOYER_PRESENCE_FIELDS } from "./fields";
import type { MemberRef, OrgPolicy, PresenceRow } from "./presence";

export type OrgSummary = {
  id: string;
  name: string;
  plan: string;
  seats_purchased: number;
  billing_email: string;
};

export type Membership = {
  member_id: string;
  org_id: string;
  role: "admin" | "member";
  status: "invited" | "active" | "left";
  joined_at: string | null;
  org: OrgSummary;
};

export type TravelRequestRow = {
  id: string;
  org_id: string;
  user_id: string;
  country_code: string;
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "declined" | "withdrawn";
  decided_by: string | null;
  decided_at: string | null;
  note: string;
  created_at: string;
};

export const getMyOrgContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      membership: Membership | null;
      policies: OrgPolicy[];
      requests: TravelRequestRow[];
    }> => {
      const { supabase, userId } = context;
      const { data: member } = await supabase
        .from("org_members")
        .select("id,org_id,role,status,joined_at")
        .eq("user_id", userId)
        .neq("status", "left")
        .maybeSingle();

      if (!member) return { membership: null, policies: [], requests: [] };

      const [{ data: org }, { data: policies }, { data: requests }] = await Promise.all([
        supabase
          .from("organisations")
          .select("id,name,plan,seats_purchased,billing_email")
          .eq("id", member.org_id)
          .maybeSingle(),
        supabase
          .from("org_policies")
          .select("id,country_code,max_days,requires_approval,note")
          .eq("org_id", member.org_id),
        supabase
          .from("travel_requests")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      return {
        membership: org
          ? ({
              member_id: member.id,
              org_id: member.org_id,
              role: member.role,
              status: member.status,
              joined_at: member.joined_at,
              org: org as OrgSummary,
            } as Membership)
          : null,
        policies: (policies ?? []) as OrgPolicy[],
        requests: (requests ?? []) as TravelRequestRow[],
      };
    },
  );

/**
 * The employee's mirror of the employer dashboard. Runs the SAME query
 * against the SAME view, scoped to the caller by the view's own predicate,
 * so /settings/employer-sharing cannot drift out of sync with what the
 * company actually sees.
 */
export const getMySharedPresence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: PresenceRow[] }> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("org_member_presence")
      .select(EMPLOYER_PRESENCE_FIELDS)
      .eq("user_id", userId)
      .order("entry_date", { ascending: false });
    return { rows: (data ?? []) as PresenceRow[] };
  });

export const getEmployerDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      org: OrgSummary | null;
      isAdmin: boolean;
      rows: PresenceRow[];
      members: MemberRef[];
      policies: OrgPolicy[];
      requests: TravelRequestRow[];
    }> => {
      const { supabase, userId } = context;
      const { data: member } = await supabase
        .from("org_members")
        .select("org_id,role,status")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (!member || member.role !== "admin") {
        return {
          org: null,
          isAdmin: false,
          rows: [],
          members: [],
          policies: [],
          requests: [],
        };
      }

      const orgId = member.org_id;
      const [{ data: org }, { data: rows }, { data: members }, { data: policies }, { data: requests }] =
        await Promise.all([
          supabase
            .from("organisations")
            .select("id,name,plan,seats_purchased,billing_email")
            .eq("id", orgId)
            .maybeSingle(),
          // Restricted view only. Do not swap this for `trips`.
          supabase
            .from("org_member_presence")
            .select(EMPLOYER_PRESENCE_FIELDS)
            .eq("org_id", orgId),
          supabase
            .from("org_member_directory")
            .select(EMPLOYER_DIRECTORY_FIELDS)
            .eq("org_id", orgId),
          supabase
            .from("org_policies")
            .select("id,country_code,max_days,requires_approval,note")
            .eq("org_id", orgId),
          supabase
            .from("travel_requests")
            .select("*")
            .eq("org_id", orgId)
            .order("created_at", { ascending: false }),
        ]);

      return {
        org: (org ?? null) as OrgSummary | null,
        isAdmin: true,
        rows: (rows ?? []) as PresenceRow[],
        members: (members ?? []) as MemberRef[],
        policies: (policies ?? []) as OrgPolicy[],
        requests: (requests ?? []) as TravelRequestRow[],
      };
    },
  );

export const createOrganisation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; billing_email: string; seats: number }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: org, error } = await supabase
      .from("organisations")
      .insert({
        name: data.name.trim().slice(0, 120),
        billing_email: data.billing_email.trim().slice(0, 200),
        seats_purchased: Math.max(10, Math.min(5000, Math.round(data.seats))),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const { error: memberError } = await supabase.from("org_members").insert({
      org_id: org.id,
      user_id: userId,
      role: "admin",
      status: "active",
      joined_at: new Date().toISOString(),
    });
    if (memberError) throw new Error(memberError.message);
    return { org_id: org.id as string };
  });

export const inviteSeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { org_id: string; email: string; role: "admin" | "member" }) => d)
  .handler(async ({ data, context }) => {
    const email = data.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid work email");
    const { error } = await context.supabase.from("org_members").insert({
      org_id: data.org_id,
      invite_email: email,
      role: data.role,
      status: "invited",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Removing a seat severs the org link and nothing else. The person's account,
 * trip history and documents remain theirs — we never delete their data here.
 */
export const removeSeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { member_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("org_members")
      .update({ status: "left", left_at: new Date().toISOString() })
      .eq("id", data.member_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Same severance, initiated by the employee. Their data stays theirs. */
export const leaveOrganisation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("org_members")
      .update({ status: "left", left_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .neq("status", "left");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      org_id: string;
      country_code: string | null;
      max_days: number;
      requires_approval: boolean;
      note: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const payload = {
      org_id: data.org_id,
      country_code: data.country_code ? data.country_code.toUpperCase().slice(0, 2) : null,
      max_days: Math.max(1, Math.min(365, Math.round(data.max_days))),
      requires_approval: data.requires_approval,
      note: data.note.slice(0, 500),
    };
    const { error } = data.id
      ? await context.supabase.from("org_policies").update(payload).eq("id", data.id)
      : await context.supabase.from("org_policies").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("org_policies").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createTravelRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      org_id: string;
      country_code: string;
      start_date: string;
      end_date: string;
      note: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("travel_requests").insert({
      org_id: data.org_id,
      user_id: context.userId,
      country_code: data.country_code.toUpperCase().slice(0, 2),
      start_date: data.start_date,
      end_date: data.end_date,
      note: data.note.slice(0, 500),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const decideTravelRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "approved" | "declined"; note?: string }) => d)
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {
      status: data.status,
      decided_by: context.userId,
      decided_at: new Date().toISOString(),
    };
    if (data.note) patch['note'] = data.note.slice(0, 500);
    const { error } = await context.supabase
      .from("travel_requests")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Pushes the employee's own trip log to the server so their day counts can be
 * shared. Country and dates only — trip notes and city ids are deliberately
 * not sent, so they cannot leak through the employer view even by accident.
 */
export const syncMyTrips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      trips: {
        id: string;
        country_code: string;
        entry_date: string;
        exit_date: string | null;
        created_at?: string;
      }[];
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: member } = await supabase
      .from("org_members")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    // Nothing is synced for people who are not in an organisation.
    if (!member) return { synced: 0 };

    await supabase.from("trips").delete().eq("user_id", userId);
    const rows = data.trips.slice(0, 500).map((t) => ({
      user_id: userId,
      country_code: t.country_code.toUpperCase().slice(0, 2),
      entry_date: t.entry_date,
      exit_date: t.exit_date,
      created_at: t.created_at ?? new Date().toISOString(),
    }));
    if (rows.length > 0) {
      const { error } = await supabase.from("trips").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { synced: rows.length };
  });

/** Public: the "book a call" form on /business. No auth, no reads. */
export const submitB2bLead = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      company_name: string;
      contact_name: string;
      work_email: string;
      team_size: number | null;
      message: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const email = data.work_email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid work email");
    const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
    const supabase = createClient(process.env['SUPABASE_URL']!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
            h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { error } = await supabase.from("b2b_leads").insert({
      company_name: data.company_name.trim().slice(0, 160),
      contact_name: data.contact_name.trim().slice(0, 160),
      work_email: email.slice(0, 200),
      team_size: data.team_size,
      message: data.message.slice(0, 2000),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
