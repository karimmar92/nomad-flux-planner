/**
 * Account deletion.
 *
 * Required by GDPR Article 17 today, and by App Store Review Guideline
 * 5.1.1(v) once this PWA is wrapped for iOS — any app offering account
 * creation must offer in-app account deletion.
 *
 * ORDER MATTERS. Storage objects are removed first, because deleting a
 * `documents` row does not delete the file it points at, and once the row is
 * gone we no longer know which files were the user's. Getting this backwards
 * orphans passport scans in a bucket forever, which would make the deletion
 * claim untrue.
 *
 *   1. Delete every storage object owned by the user
 *   2. Delete every database row, then the auth identity (single RPC)
 *   3. Clear local caches — localStorage, IndexedDB, the sync queue
 *   4. Sign out
 *
 * Step 3 is not cosmetic. The tracker is offline-first, so a full copy of the
 * user's travel history lives on the device. Deleting the server copy while
 * leaving the local one intact is not erasure — and the next flush would
 * re-upload it.
 */
import { supabase } from "@/integrations/supabase/client";

const DOCUMENTS_BUCKET = "documents";

export type DeletionResult = {
  filesRemoved: number;
};

/** Remove every stored file belonging to this user. */
async function deleteStorageObjects(userId: string): Promise<number> {
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).list(userId, {
    limit: 1000,
  });
  // A missing folder is fine — it means nothing was ever uploaded.
  if (error || !data || data.length === 0) return 0;

  const paths = data.map((f) => `${userId}/${f.name}`);
  const { error: removeError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .remove(paths);
  if (removeError) throw new Error(`Could not delete stored files: ${removeError.message}`);
  return paths.length;
}

/** Wipe every local trace. Runs even if the remote step already succeeded. */
async function clearLocalData(): Promise<void> {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("driftly.")) window.localStorage.removeItem(key);
    }
  } catch {
    /* private mode or storage disabled */
  }

  try {
    const { idbClear } = await import("../offline/idb");
    await idbClear();
  } catch {
    /* IndexedDB unavailable */
  }
}

/**
 * Delete the account and everything attached to it. Irreversible.
 *
 * Throws if the remote deletion fails, so the caller can tell the user it did
 * NOT happen. Never report success on a partial deletion — someone who is told
 * their passport scans are gone must be right.
 */
export async function deleteAccount(): Promise<DeletionResult> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error("You are not signed in.");

  const filesRemoved = await deleteStorageObjects(userId);

  // `delete_my_account` is defined in
  // supabase/migrations/20260805090000_delete_my_account.sql but will not
  // appear in integrations/supabase/types.ts until that migration has been
  // applied and the types regenerated. The cast keeps the build green in the
  // meantime — remove it once the generated types include the function, so
  // that a future rename fails at compile time rather than at runtime.
  const rpc = supabase.rpc as unknown as (fn: string) => Promise<{ error: { message: string } | null }>;
  const { error } = await rpc("delete_my_account");
  if (error) throw new Error(error.message);

  await clearLocalData();
  await supabase.auth.signOut();

  return { filesRemoved };
}
