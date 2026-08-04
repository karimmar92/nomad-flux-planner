import { useState } from "react";
import { toast } from "sonner";

/** Waitlist capture. Writes locally until the `waitlist` table is live. */
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
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    const key = "driftly.waitlist";
    const existing = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    existing.push({ email, feature, created_at: new Date().toISOString() });
    window.localStorage.setItem(key, JSON.stringify(existing));
    setDone(true);
    toast.success("You're on the list");
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

      {done ? (
        <div className="panel p-4 text-sm text-positive">
          Registered. We&apos;ll email you when {feature} opens.
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
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Notify me
          </button>
        </form>
      )}
      <p className="text-xs text-muted-foreground">
        We&apos;re validating demand before building either of these. Signing up is the vote.
      </p>
    </div>
  );
}
