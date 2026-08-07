/**
 * Plans — data access.
 *
 * See docs/plans-spec.md. This surfaces PLANS, never people: a group, in a
 * public venue, organised around an activity. There is no matching, no gender
 * field, no photos and no 1:1 messaging, and adding any of them changes what
 * the product is.
 *
 * Blocking is enforced by RLS (see the migration), so nothing here needs to
 * filter for it — a blocked user's plans simply do not come back.
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * The `plans` and `plan_attendees` tables are created by a migration that has
 * not been applied to this project yet, so the generated Supabase types do not
 * include them. Cast through a loose query builder so the code compiles and
 * runs; once the migration lands and types are regenerated, drop this and use
 * the typed `supabase.from(...)` directly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function from(table: string): any {
  return (supabase as unknown as { from: (t: string) => any }).from(table);
}

export const PLAN_ACTIVITIES = [
  "coffee",
  "lunch",
  "dinner",
  "drinks",
  "coworking",
  "walk",
  "gym",
  "other",
] as const;
export type PlanActivity = (typeof PLAN_ACTIVITIES)[number];

export const ACTIVITY_LABEL: Record<PlanActivity, string> = {
  coffee: "Coffee",
  lunch: "Lunch",
  dinner: "Dinner",
  drinks: "Drinks",
  coworking: "Coworking",
  walk: "Walk",
  gym: "Gym",
  other: "Something else",
};

/** Nothing further out than this. Distant plans have poor turnout. */
export const MAX_DAYS_AHEAD = 14;
export const DEFAULT_CAPACITY = 6;
export const MIN_CAPACITY = 2;
export const MAX_CAPACITY = 10;

export type Plan = {
  id: string;
  host_id: string;
  city_id: string;
  activity: PlanActivity;
  venue_name: string;
  venue_hint: string | null;
  starts_at: string;
  capacity: number;
  note: string | null;
  status: "open" | "cancelled";
  created_at: string;
};

export type PlanWithCounts = Plan & {
  goingCount: number;
  isAttending: boolean;
  isHost: boolean;
};

export type NewPlan = {
  city_id: string;
  activity: PlanActivity;
  venue_name: string;
  venue_hint?: string;
  starts_at: string;
  capacity: number;
  note?: string;
};

/**
 * Upcoming plans in a city, soonest first.
 *
 * Past plans are filtered here rather than flagged in the table: `starts_at`
 * is the truth, and a stored "past" status would need a cron job to stay
 * honest.
 */
export async function listPlans(cityId: string, userId: string | null): Promise<PlanWithCounts[]> {
  const { data, error } = await supabase
    .from("plans")
    .select("*, plan_attendees(user_id)")
    .eq("city_id", cityId)
    .eq("status", "open")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(50);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const r = row as unknown as Plan & { plan_attendees: { user_id: string }[] };
    const attendees = r.plan_attendees ?? [];
    return {
      ...r,
      goingCount: attendees.length,
      isAttending: userId ? attendees.some((a) => a.user_id === userId) : false,
      isHost: userId === r.host_id,
    };
  });
}

export async function getPlan(planId: string, userId: string | null): Promise<PlanWithCounts | null> {
  const { data, error } = await supabase
    .from("plans")
    .select("*, plan_attendees(user_id)")
    .eq("id", planId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const r = data as unknown as Plan & { plan_attendees: { user_id: string }[] };
  const attendees = r.plan_attendees ?? [];
  return {
    ...r,
    goingCount: attendees.length,
    isAttending: userId ? attendees.some((a) => a.user_id === userId) : false,
    isHost: userId === r.host_id,
  };
}

export async function createPlan(hostId: string, plan: NewPlan): Promise<string> {
  const { data, error } = await supabase
    .from("plans")
    .insert({ ...plan, host_id: hostId })
    .select("id")
    .single();
  if (error) throw new Error(friendly(error.message));
  return (data as { id: string }).id;
}

/**
 * Capacity is enforced by a database trigger, not here. Two people tapping
 * Join simultaneously would both pass a client-side check, so the error path
 * below is a real case rather than a formality.
 */
export async function joinPlan(planId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("plan_attendees")
    .insert({ plan_id: planId, user_id: userId });
  if (error) throw new Error(friendly(error.message));
}

/** Leaving is silent — the host is not notified. Someone who feels
 *  uncomfortable should be able to withdraw without an announcement. */
export async function leavePlan(planId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("plan_attendees")
    .delete()
    .eq("plan_id", planId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function cancelPlan(planId: string): Promise<void> {
  const { error } = await supabase
    .from("plans")
    .update({ status: "cancelled" })
    .eq("id", planId);
  if (error) throw new Error(error.message);
}

/** Postgres messages are not written for humans standing in a bar. */
function friendly(message: string): string {
  if (message.includes("full")) return "This plan just filled up.";
  if (message.includes("cancelled")) return "This plan was cancelled.";
  if (message.includes("already started")) return "This plan has already started.";
  if (message.includes("plans_horizon")) return `Plans can only be up to ${MAX_DAYS_AHEAD} days ahead.`;
  if (message.includes("Rate limit")) return "You're creating plans very quickly — try again in a minute.";
  if (message.includes("duplicate key")) return "You're already going.";
  return message;
}

/** "Thu 7:00 pm" — short, unambiguous, no numeric-only dates. */
export function formatPlanTime(iso: string, locale = "en"): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}
