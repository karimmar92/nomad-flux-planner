import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { joinWaitlist } from "@/lib/waitlist.functions";
import { alreadyJoinedLocally, submitWaitlist } from "@/lib/waitlist";

/** Waitlist capture. Writes to the `waitlist` table, with an offline fallback
 *  that drains through the sync queue when connectivity returns. */
export function ComingSoon({
  title,
  feature,
  plan,
  bullets,
}: {
  title: string;
  feature: "community" | "stays";
  plan: string;
  bullets: string[];
}) {
  const join = useServerFn(joinWaitlist);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<"idle" | "joined" | "already" | "queued">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (alreadyJoinedLocally(feature)) {
      setState("already");
      toast.message("You're already on the list");
      return;
    }
    setBusy(true);
    try {
      const result = await submitWaitlist(join, { email, feature });
      setState(result);
      toast[result === "already" ? "message" : "success"](
        result === "already"
          ? "You're already on the list"
          : result === "queued"
            ? "Saved offline — we'll send it when you're back online"
            : "You're on the list",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign you up. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 py-6">
      <div>
        <span className="label-xs">Coming soon</span>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{plan}</p>
      </div>

      <ul className="panel space-y-2 p-4 text-sm">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="text-primary">—</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {state !== "idle" ? (
        <div className="panel p-4 text-sm text-positive">
          {state === "already"
            ? `You're already on the list for ${feature}.`
            : state === "queued"
              ? `Saved on this device. We'll register you for ${feature} as soon as you're online.`
              : `Registered. We'll email you when ${feature} opens.`}
        </div>
      ) : (
        <form onSubmit={submit} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Sending…" : "Notify me"}
          </button>
        </form>
      )}
      <p className="text-xs text-muted-foreground">
        We&apos;re validating demand before building either of these. Signing up is the vote.
      </p>
    </div>
  );
}
