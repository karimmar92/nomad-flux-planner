import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/use-session";
import { useProfile } from "@/lib/store";
import { abbreviateName, REVIEW_LIMITS, validateReview } from "@/lib/reviews/reviews";
import {
  deleteMyReview,
  getMyReview,
  submitReview,
} from "@/lib/reviews/reviews.functions";

/**
 * Only paying customers can write, and the server re-checks the plan — this
 * component decides what to *show*, never what is allowed.
 */
export function ReviewForm() {
  const { signedIn, ready } = useSession();
  const { profile } = useProfile();
  const qc = useQueryClient();

  const fetchMine = useServerFn(getMyReview);
  const send = useServerFn(submitReview);
  const remove = useServerFn(deleteMyReview);

  const { data, isLoading } = useQuery({
    queryKey: ["my-review"],
    queryFn: () => fetchMine({}),
    enabled: signedIn,
    retry: false,
  });

  const existing = data?.review ?? null;
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [abbreviated, setAbbreviated] = useState(false);

  const startEditing = () => {
    setRating(existing?.rating ?? 5);
    setHeadline(existing?.headline ?? "");
    setBody(existing?.body ?? "");
    setName(existing?.display_name ?? profile.display_name ?? "");
    setRole(existing?.author_role ?? "");
    setAbbreviated(existing?.abbreviated ?? false);
    setOpen(true);
  };

  const mutation = useMutation({
    mutationFn: () =>
      send({
        data: {
          rating,
          headline,
          body,
          display_name: name,
          author_role: role || null,
          country_code: profile.nationality ?? null,
          abbreviated,
        },
      }),
    onSuccess: () => {
      toast.success("Thanks — your review is with us and goes live once we have read it.");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["my-review"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not save your review."),
  });

  const removal = useMutation({
    mutationFn: () => remove({}),
    onSuccess: () => {
      toast.success("Review deleted.");
      void qc.invalidateQueries({ queryKey: ["my-review"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete your review."),
  });

  if (!ready) return null;

  if (!signedIn) {
    return (
      <section className="panel p-4 text-sm text-muted-foreground">
        Reviews come from paying customers only.{" "}
        <Link to="/auth" search={{ next: "/reviews" }} className="underline">
          Sign in
        </Link>{" "}
        to write yours.
      </section>
    );
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!data?.canWrite) {
    return (
      <section className="panel p-4 text-sm text-muted-foreground">
        Reviews are open to customers on a paid plan, so every one you read here is from someone
        who actually paid.{" "}
        <Link to="/pricing" className="underline">
          See the plans
        </Link>
        .
      </section>
    );
  }

  if (!open) {
    return (
      <section className="panel space-y-3 p-4">
        {existing ? (
          <>
            <div className="text-sm">
              <span className="font-medium">Your review</span>{" "}
              <span
                className={cn(
                  "ms-1 rounded-full px-2 py-0.5 text-xs",
                  existing.status === "approved"
                    ? "bg-accent-positive/10 text-accent-positive"
                    : existing.status === "rejected"
                      ? "bg-negative/10 text-negative"
                      : "bg-accent-warning/10 text-accent-warning",
                )}
              >
                {existing.status === "approved"
                  ? "Published"
                  : existing.status === "rejected"
                    ? "Not published"
                    : "Waiting for approval"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{existing.headline}</p>
            {existing.review_note ? (
              <p className="text-xs text-muted-foreground">Note from us: {existing.review_note}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary min-h-11" onClick={startEditing}>
                Edit review
              </button>
              <button
                type="button"
                className="btn-ghost min-h-11 text-negative"
                onClick={() => removal.mutate()}
              >
                Delete
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Editing sends the review back for approval before it reappears.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm">
              You are a customer, so you can write a review. It goes live once we have read it.
            </p>
            <button type="button" className="cta min-h-11" onClick={startEditing}>
              Write a review
            </button>
          </>
        )}
      </section>
    );
  }

  const problem = validateReview({
    rating,
    headline,
    body,
    display_name: name,
    author_role: role,
  });

  return (
    <form
      className="panel space-y-4 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (problem) {
          toast.error(problem);
          return;
        }
        mutation.mutate();
      }}
    >
      <div>
        <span className="label-xs">Rating</span>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              aria-pressed={rating === n}
              className="flex h-11 w-11 items-center justify-center rounded-md border border-border"
              onClick={() => setRating(n)}
            >
              <Star
                className={cn(
                  "h-5 w-5",
                  n <= rating ? "fill-accent-warning text-accent-warning" : "text-border",
                )}
                aria-hidden
              />
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="label-xs">Headline</span>
        <input
          className="input mt-1 min-h-11 w-full"
          value={headline}
          maxLength={REVIEW_LIMITS.headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Finally stopped guessing my Schengen days"
        />
      </label>

      <label className="block">
        <span className="label-xs">Your review</span>
        <textarea
          className="input mt-1 min-h-32 w-full"
          value={body}
          maxLength={REVIEW_LIMITS.body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What changed for you?"
        />
        <span className="text-xs text-muted-foreground">
          {body.length}/{REVIEW_LIMITS.body}
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label-xs">Name shown</span>
          <input
            className="input mt-1 min-h-11 w-full"
            value={name}
            maxLength={REVIEW_LIMITS.name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label-xs">Role (optional)</span>
          <input
            className="input mt-1 min-h-11 w-full"
            value={role}
            maxLength={REVIEW_LIMITS.role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="freelance designer"
          />
        </label>
      </div>

      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={abbreviated}
          onChange={(e) => setAbbreviated(e.target.checked)}
        />
        Show my name as {abbreviateName(name || "First Last") || "First L."}
      </label>

      <p className="text-xs text-muted-foreground">
        We publish your name, your role if you gave one, your country and your plan. Never your
        email, never where you are.
      </p>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="cta min-h-11" disabled={mutation.isPending}>
          {mutation.isPending ? "Sending…" : "Submit for approval"}
        </button>
        <button type="button" className="btn-ghost min-h-11" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
