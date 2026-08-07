/**
 * Scroll-reveal primitive. One IntersectionObserver, no dependency.
 *
 * The psychology it serves is real but modest: staged reveal paces reading and
 * stops a long page reading as a wall. It is NOT a loading gate — content is in
 * the DOM from the first paint, so search engines and screen readers see
 * everything regardless, and a failed observer leaves content visible rather
 * than blank.
 *
 * Reveals fire ONCE. Re-animating on every scroll past is the thing that makes
 * marketing pages feel cheap and unusable on a second read.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  /** Stagger, in ms. Keep under ~200 — beyond that it reads as lag. */
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    // No observer (old browser, SSR hydration edge) => show immediately.
    if (!el || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      // Fire slightly before the element reaches the viewport, so the animation
      // completes as it arrives rather than starting once it is already read.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      style={shown && delay ? { animationDelay: `${delay}ms` } : undefined}
      className={cn("reveal", shown && "reveal-in", className)}
    >
      {children}
    </Tag>
  );
}

/**
 * Counts up to a number when it scrolls into view.
 *
 * Used only for figures that are facts (cities in the dataset, days in a
 * window). Never for invented metrics — a fake "12,431 nomads tracked"
 * counter is the fastest way to lose a sceptical reader, and it is a false
 * statement in a commercial communication.
 */
export function CountUp({
  to,
  duration = 900,
  className,
}: {
  to: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    const reduced =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!el || reduced || typeof IntersectionObserver === "undefined") {
      setValue(to);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        // Ease-out: fast start, settles gently. Linear counting looks robotic.
        setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
