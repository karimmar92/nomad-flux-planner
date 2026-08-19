import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { publicSupabase } from "./reviews.server";
import { abbreviateName, validateReview } from "./reviews";
import type { OwnReview, PublicReview } from "./reviews";

const PUBLIC_COLUMNS =
  "id, rating, headline, body, display_name, author_role, country_code, plan_at_review, featured, created_at";

/**
 * Public, unauthenticated read. Called from a public route loader and from the
 * landing page, so it must never require a bearer token. The `approved` filter
 * is enforced by RLS as well; repeating it here keeps the query honest.
 */
export const listApprovedReviews = createServerFn({ method: "GET" })
  .inputValidator((d: { limit?: number } | undefined) => d ?? {})
  .handler(async ({ data }): Promise<PublicReview[]> => {
    const limit = Math.min(Math.max(data.limit ?? 50, 1), 100);
    const { data: rows, error } = await publicSupabase()
      .from("reviews")
      .select(PUBLIC_COLUMNS)
      .eq("status", "approved")
      .order("featured", { ascending: false })
      .order("rating", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (rows ?? []) as PublicReview[];
  });

export const getMyReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ review: OwnReview | null; canWrite: boolean }> => {
    const { supabase, userId } = context;
    const [{ data: review }, { data: profile }] = await Promise.all([
      supabase
        .from("reviews")
        .select(`${PUBLIC_COLUMNS}, status, review_note, abbreviated`)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.from("profiles").select("plan").eq("id", userId).maybeSingle(),
    ]);
    const plan = profile?.plan ?? "free";
    return {
      review: (review as OwnReview | null) ?? null,
      canWrite: ["starter", "pro", "teams", "founding_lifetime"].includes(plan),
    };
  });

export type SubmitReviewInput = {
  rating: number;
  headline: string;
  body: string;
  display_name: string;
  author_role?: string | null;
  country_code?: string | null;
  abbreviated?: boolean;
};

/**
 * Writes always land as `pending` — the database trigger forces it, so an
 * author cannot publish themselves even by calling the Data API directly.
 * `plan_at_review` is read from the profile server-side; it is a claim about
 * the customer, so it can never come from the request body.
 */
export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: SubmitReviewInput) => d)
  .handler(async ({ data, context }) => {
    const problem = validateReview(data);
    if (problem) throw new Error(problem);

    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .maybeSingle();
    const plan = profile?.plan ?? "free";
    if (!["starter", "pro", "teams", "founding_lifetime"].includes(plan)) {
      throw new Error("Reviews are open to customers on a paid plan.");
    }

    const chosen = data.display_name.trim();
    const row = {
      user_id: userId,
      rating: data.rating,
      headline: data.headline.trim(),
      body: data.body.trim(),
      display_name: data.abbreviated ? abbreviateName(chosen) : chosen,
      author_role: data.author_role?.trim() || null,
      country_code: data.country_code?.trim().toUpperCase().slice(0, 2) || null,
      abbreviated: Boolean(data.abbreviated),
      plan_at_review: plan,
    };

    const { error } = await supabase
      .from("reviews")
      .upsert(row, { onConflict: "user_id" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteMyReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("reviews")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Moderation queue. RLS already restricts the read to admins. */
export const listAllReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { data, error } = await context.supabase
      .from("reviews")
      .select(`${PUBLIC_COLUMNS}, status, review_note, abbreviated`)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as OwnReview[];
  });

export const moderateReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { id: string; status?: "approved" | "rejected"; featured?: boolean; note?: string }) => d,
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const patch: {
      status?: "approved" | "rejected";
      featured?: boolean;
      review_note?: string | null;
    } = {};
    if (data.status) patch.status = data.status;
    if (typeof data.featured === "boolean") patch.featured = data.featured;
    if (data.note !== undefined) patch.review_note = data.note.slice(0, 500) || null;

    const { error } = await context.supabase.from("reviews").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
