/**
 * Review shapes and the display rules that make a testimonial trustworthy
 * without exposing the reviewer.
 *
 * Never leave this module: email, user id, precise location. A review shows a
 * name the reviewer chose, an optional self-described role, a country, and the
 * plan they were on when they wrote it — nothing else.
 */

export type ReviewStatus = "pending" | "approved" | "rejected";

export type PublicReview = {
  id: string;
  rating: number;
  headline: string;
  body: string;
  display_name: string;
  author_role: string | null;
  country_code: string | null;
  plan_at_review: string;
  featured: boolean;
  created_at: string;
};

export type OwnReview = PublicReview & {
  status: ReviewStatus;
  review_note: string | null;
  abbreviated: boolean;
};

export const REVIEW_LIMITS = {
  headline: 80,
  body: 600,
  bodyMin: 20,
  name: 60,
  role: 60,
} as const;

/** "Jane Kowalski" → "Jane K." Single-word names are left alone. */
export function abbreviateName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  const last = parts[parts.length - 1]!;
  return `${parts.slice(0, -1).join(" ")} ${last.charAt(0).toUpperCase()}.`;
}

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  teams: "Teams",
  founding_lifetime: "Founding member",
};

/**
 * "Verified customer — Pro since Mar 2026". The month is deliberately coarse:
 * a day-precise join date is a fingerprint, a month is social proof.
 */
export function verifiedBadge(planAtReview: string, createdAt: string): string {
  const label = PLAN_LABELS[planAtReview];
  const since = new Date(createdAt);
  const month = Number.isNaN(since.getTime())
    ? ""
    : ` since ${since.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })}`;
  return label ? `Verified customer — ${label}${month}` : `Verified customer${month}`;
}

export function validateReview(input: {
  rating: number;
  headline: string;
  body: string;
  display_name: string;
  author_role?: string | null;
}): string | null {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
    return "Choose a rating from 1 to 5 stars.";
  const headline = input.headline.trim();
  if (headline.length < 3) return "Add a short headline.";
  if (headline.length > REVIEW_LIMITS.headline)
    return `Headline must be ${REVIEW_LIMITS.headline} characters or fewer.`;
  const body = input.body.trim();
  if (body.length < REVIEW_LIMITS.bodyMin)
    return `Tell us a little more — at least ${REVIEW_LIMITS.bodyMin} characters.`;
  if (body.length > REVIEW_LIMITS.body)
    return `Review must be ${REVIEW_LIMITS.body} characters or fewer.`;
  const name = input.display_name.trim();
  if (!name) return "Add the name you want shown.";
  if (name.length > REVIEW_LIMITS.name) return "That name is too long.";
  if (input.author_role && input.author_role.trim().length > REVIEW_LIMITS.role)
    return "That role description is too long.";
  return null;
}
