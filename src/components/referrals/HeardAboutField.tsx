import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { saveHeardAbout } from "@/lib/referrals/user.functions";

/**
 * Self-reported attribution. Cookie-based tracking loses a meaningful share of
 * conversions to tracking prevention and ad blockers; this free-text answer is
 * the reconciliation signal when a creator says their numbers look low.
 */
export function HeardAboutField({ signedIn }: { signedIn: boolean }) {
  const save = useServerFn(saveHeardAbout);
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);

  if (!signedIn) return null;

  return (
    <section className="panel space-y-2 p-4">
      <label className="block">
        <span className="label-xs">How did you hear about us?</span>
        <input
          value={value}
          maxLength={300}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          onBlur={async () => {
            if (!value.trim()) return;
            try {
              await save({ data: { heard_about: value } });
              setSaved(true);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Could not save.");
            }
          }}
          placeholder="A podcast, a friend, a YouTube video…"
          className="mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        {saved ? "Saved. " : ""}It helps us credit the right creator when tracking gets blocked.
      </p>
    </section>
  );
}
