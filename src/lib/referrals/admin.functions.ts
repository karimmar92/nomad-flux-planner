/**
 * Admin surface for the creator program: application review, the soft-flag
 * queue, and manual ledger adjustments.
 *
 * Adjustments are appended, never applied to a balance column, and always
 * carry a note. Role is checked server-side against the user_roles table.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { LedgerRow } from "./commission";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

export type AdminOverview = {
  applications: {
    id: string;
    user_id: string;
    contact_email: string;
    audience_description: string;
    primary_channel: string;
    channel_url: string | null;
    audience_size: number | null;
    pitch: string | null;
    status: string;
    created_at: string;
  }[];
  flags: {
    id: string;
    creator_id: string | null;
    kind: string;
    severity: string;
    detail: Record<string, number | string>;
    status: string;
    created_at: string;
  }[];
  creators: { id: string; user_id: string; code: string; status: string }[];
  recentAdjustments: LedgerRow[];
};

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    await assertAdmin(context);
    const { supabase } = context;

    const [{ data: applications }, { data: flags }, { data: creators }, { data: adjustments }] =
      await Promise.all([
        supabase
          .from("creator_applications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("fraud_flags")
          .select("*")
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("creators").select("id, user_id, code, status").limit(200),
        supabase
          .from("commission_ledger")
          .select("*")
          .eq("type", "adjustment")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

    return {
      applications: (applications ?? []) as AdminOverview["applications"],
      flags: (flags ?? []) as AdminOverview["flags"],
      creators: creators ?? [],
      recentAdjustments: (adjustments ?? []) as LedgerRow[],
    };
  });

export const reviewApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; decision: "approved" | "rejected"; note?: string }) => {
    if (!input.id) throw new Error("Missing application id.");
    if (input.decision !== "approved" && input.decision !== "rejected") {
      throw new Error("Invalid decision.");
    }
    return { id: input.id, decision: input.decision, note: input.note?.trim().slice(0, 500) ?? "" };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabase } = context;

    const { data: application, error: readError } = await supabase
      .from("creator_applications")
      .select("id, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (readError || !application) throw new Error("Application not found.");

    const { error } = await supabase
      .from("creator_applications")
      .update({
        status: data.decision,
        review_note: data.note || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (data.decision === "approved") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("referral_code")
        .eq("id", application.user_id)
        .maybeSingle();

      const code = profile?.referral_code ?? application.user_id.slice(0, 8).toUpperCase();
      await supabase
        .from("creators")
        .upsert({ user_id: application.user_id, code }, { onConflict: "user_id" });
      await supabase
        .from("user_roles")
        .upsert({ user_id: application.user_id, role: "creator" }, { onConflict: "user_id,role" });
    }

    return { ok: true };
  });

export const createAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { creator_id: string; amount_cents: number; note: string }) => {
    if (!input.creator_id) throw new Error("Pick a creator.");
    if (!Number.isFinite(input.amount_cents) || Math.round(input.amount_cents) === 0) {
      throw new Error("Amount must be a non-zero number of cents.");
    }
    const note = input.note?.trim() ?? "";
    if (note.length < 5 || note.length > 500) {
      throw new Error("A note of 5–500 characters is required on every adjustment.");
    }
    return { creator_id: input.creator_id, amount_cents: Math.round(input.amount_cents), note };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("commission_ledger").insert({
      creator_id: data.creator_id,
      type: "adjustment",
      amount_cents: data.amount_cents,
      status: "available",
      available_at: new Date().toISOString(),
      note: data.note,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resolveFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: "cleared" | "actioned" }) => {
    if (!input.id) throw new Error("Missing flag id.");
    if (input.status !== "cleared" && input.status !== "actioned") {
      throw new Error("Invalid status.");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("fraud_flags")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
