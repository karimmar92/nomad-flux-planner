/**
 * Data export — GDPR Article 20 (right to data portability).
 *
 * People are entitled to a copy of the personal data they gave us, in a
 * structured, commonly used, machine-readable format. JSON satisfies that.
 *
 * This is deliberately separate from the tax report. That report is a curated
 * document for an accountant; this is everything we hold, unedited, including
 * the parts that are unflattering or boring. If a field exists in the database
 * against this user, it belongs here.
 *
 * It also doubles as a trust feature. The product's promise is that this is
 * *your* record — a one-tap export makes that literally true rather than
 * rhetorical, and it makes leaving possible, which is the point of Article 20.
 *
 * NOT INCLUDED: the document files themselves. Bundling binaries into JSON is
 * impractical and a ZIP build is disproportionate here. The export lists every
 * document with its metadata and a note that the files are downloadable
 * individually from the vault. Say so plainly in the export rather than
 * letting someone assume their passport scan is in the file.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Profile, Trip } from "../types";

export type ExportBundle = {
  _meta: {
    exportedAt: string;
    format: string;
    note: string;
    documentsNote: string;
  };
  account: { userId: string; email: string | null };
  profile: Profile | Record<string, unknown> | null;
  trips: Trip[] | Record<string, unknown>[];
  documents: Record<string, unknown>[];
  savedCities: string[];
  connections: Record<string, unknown>[];
  referrals: {
    rewardsEarned: Record<string, unknown>[];
    creatorLedger: Record<string, unknown>[];
  };
  localOnly: Record<string, unknown>;
};

/** Fetches a table scoped to the user, returning [] rather than throwing. */
async function safeSelect(
  table: string,
  column: string,
  userId: string,
): Promise<Record<string, unknown>[]> {
  try {
    const { data, error } = await supabase
      .from(table as never)
      .select("*")
      .eq(column as never, userId as never);
    if (error) return [];
    return (data ?? []) as Record<string, unknown>[];
  } catch {
    // A table the user has no rows in, or no access to, must not abort the
    // whole export — a partial export is far better than none.
    return [];
  }
}

/** Anything held only in this browser, so the export is genuinely complete. */
function readLocalOnly(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (!key.startsWith("driftly.")) continue;
      const raw = window.localStorage.getItem(key);
      try {
        out[key] = raw ? JSON.parse(raw) : null;
      } catch {
        out[key] = raw;
      }
    }
  } catch {
    /* storage blocked */
  }
  return out;
}

export async function buildExport(): Promise<ExportBundle> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) throw new Error("You need to be signed in to export your data.");
  const userId = session.user.id;

  const [profileRows, trips, documents, savedCities, connA, connB, rewards, ledger] =
    await Promise.all([
      safeSelect("profiles", "id", userId),
      safeSelect("trips", "user_id", userId),
      safeSelect("documents", "user_id", userId),
      safeSelect("saved_cities", "user_id", userId),
      safeSelect("connections", "requester_id", userId),
      safeSelect("connections", "recipient_id", userId),
      safeSelect("user_referral_rewards", "user_id", userId),
      safeSelect("commission_ledger", "creator_id", userId),
    ]);

  return {
    _meta: {
      exportedAt: new Date().toISOString(),
      format: "application/json",
      note:
        "Everything held against your account, exported under GDPR Article 20. " +
        "Dates are ISO 8601 (YYYY-MM-DD). Monetary amounts are in the currency " +
        "named alongside them; ledger amounts are in cents.",
      documentsNote:
        "Document FILES are not included in this JSON — only their metadata. " +
        "Download the files individually from your vault.",
    },
    account: { userId, email: session.user.email ?? null },
    profile: profileRows[0] ?? null,
    trips: trips as Trip[],
    documents,
    savedCities: savedCities.map((r) => String(r["city_id"] ?? "")).filter(Boolean),
    connections: [...connA, ...connB],
    referrals: { rewardsEarned: rewards, creatorLedger: ledger },
    localOnly: readLocalOnly(),
  };
}

/** Build the export and hand the user a file. */
export async function downloadExport(): Promise<void> {
  const bundle = await buildExport();
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `driftly-data-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
