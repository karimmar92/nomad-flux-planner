import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listApprovedReviews } from "@/lib/reviews/reviews.functions";
import { ReviewCard } from "./ReviewCard";

/**
 * Three highest-rated approved reviews. With zero reviews the section renders
 * nothing at all — an empty "what customers say" block on a page that admits
 * the product is new reads worse than no block.
 */
export function TestimonialStrip() {
  const { data } = useQuery({
    queryKey: ["reviews", "approved", "strip"],
    queryFn: () => listApprovedReviews({ data: { limit: 3 } }),
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (!data || data.length === 0) return null;

  return (
    <section className="section-gap">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="display-lg text-balance">What customers say.</h2>
        <p className="lede mt-3">
          Written by people on a paid plan. Published unedited, after we have read them.
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {data.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>

      <div className="mt-6 text-center">
        <Link to="/reviews" className="text-sm underline">
          Read all reviews
        </Link>
      </div>
    </section>
  );
}
