/**
 * ADMIN READS — waitlist leads and funnel events.
 *
 * Both are admin-only and both check the role through the *caller's* client
 * (`requireSupabaseAuth`), never the service role. RLS enforces the same rule
 * a second time, so a bug here cannot leak a lead list.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WaitlistLead = {
  id: string;
  email: string;
  feature: string;
  city_id: string | null;
  created_at: string;
};

export type FunnelEventRow = {
  id: string;
  event: string;
  feature: string | null;
  reason: string | null;
  plan: string | null;
  checks_left: number | null;
  session_id: string | null;
  user_id: string | null;
  props: Record<string, unknown> | null;
  created_at: string;
};

async function assertAdmin(context: { supabase: unknown; userId: string }) {
  const supabase = context.supabase as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
  };
  const { data } = await supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

/** Community and Stays sign-ups, newest first. Feature filtering happens client-side. */
export const listWaitlistLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WaitlistLead[]> => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("waitlist")
      .select("id, email, feature, city_id, created_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return (data ?? []) as WaitlistLead[];
  });

/** Raw funnel rows for the debug view — the payload exactly as stored. */
export const listFunnelEvents = createServerFn({ method: "GET" })
  .inputValidator((d: { limit?: number } | undefined) => d ?? {})
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<FunnelEventRow[]> => {
    await assertAdmin(context);
    const limit = Math.min(Math.max(data.limit ?? 200, 1), 1000);
    const { data: rows, error } = await context.supabase
      .from("analytics_events")
      .select("id, event, feature, reason, plan, checks_left, session_id, user_id, props, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (rows ?? []) as FunnelEventRow[];
  });
