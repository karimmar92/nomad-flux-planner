import { enqueue } from "@/lib/offline/sync-queue";
import type { WaitlistFeature, WaitlistInput } from "@/lib/waitlist.functions";

export type WaitlistResult = "joined" | "already" | "queued";

const LOCAL_KEY = "driftly.waitlist";

type LocalEntry = WaitlistInput & { created_at: string; synced: boolean };

function readLocal(): LocalEntry[] {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "[]") as LocalEntry[];
  } catch {
    return [];
  }
}

function writeLocal(entries: LocalEntry[]) {
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(entries.slice(-200)));
}

export function alreadyJoinedLocally(feature: WaitlistFeature, cityId?: string | null) {
  if (typeof window === "undefined") return false;
  return readLocal().some(
    (e) => e.feature === feature && (e.city_id ?? null) === (cityId ?? null),
  );
}

/**
 * Send a waitlist signup, falling back to the offline queue.
 *
 * These emails are the demand signal that decides what gets built, so the
 * local write is a fallback that drains through the sync queue — never the
 * only copy. Someone signing up from a plane still counts.
 */
export async function submitWaitlist(
  submit: (opts: { data: WaitlistInput }) => Promise<{ ok: boolean; already: boolean }>,
  input: WaitlistInput,
): Promise<WaitlistResult> {
  const email = input.email.trim().toLowerCase();
  const payload: WaitlistInput = {
    email,
    feature: input.feature,
    city_id: input.city_id ?? null,
  };

  const local = readLocal();
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  if (!offline) {
    try {
      const res = await submit({ data: payload });
      writeLocal([
        ...local.filter(
          (e) => !(e.email === email && e.feature === payload.feature && (e.city_id ?? null) === (payload.city_id ?? null)),
        ),
        { ...payload, created_at: new Date().toISOString(), synced: true },
      ]);
      return res.already ? "already" : "joined";
    } catch {
      /* fall through to the offline path */
    }
  }

  writeLocal([...local, { ...payload, created_at: new Date().toISOString(), synced: false }]);
  await enqueue({ entity: "waitlist", action: "upsert", payload });
  return "queued";
}
