import { supabase } from "@/integrations/supabase/client";
import { idbDel, idbGet, idbSet } from "@/lib/offline/idb";
import { toDayIndex } from "@/lib/schengen";
import { todayIso } from "@/lib/trip-dates";

/**
 * Document vault.
 *
 * Offline-first by design: the whole point of the vault is retrieving a
 * passport scan at a border with no connectivity. Every file is written to
 * IndexedDB as a Blob at upload time and re-cached on login, so opening a
 * document never touches the network. The remote copy in Supabase Storage is
 * the durable backup, not the read path.
 *
 * Storage is a PRIVATE bucket. Files are namespaced <user_id>/<uuid>-<name>,
 * RLS restricts every object to its owner, and downloads always go through a
 * short-lived signed URL. No public URLs exist for vault files.
 */

export const DOCUMENT_TYPES = [
  "passport",
  "visa_approval",
  "insurance",
  "proof_of_address",
  "onward_ticket",
  "vaccination",
  "other",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  passport: "Passport",
  visa_approval: "Visa approval",
  insurance: "Insurance certificate",
  proof_of_address: "Proof of address",
  onward_ticket: "Onward ticket",
  vaccination: "Vaccination record",
  other: "Other",
};

export type VaultDocument = {
  id: string;
  title: string;
  type: DocumentType;
  country_code: string | null;
  expires_on: string | null;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  notes: string;
  created_at: string;
};

const INDEX_KEY = "vault.index";
const BLOB_KEY = (id: string) => `vault.blob.${id}`;
const SIGNED_URL_TTL_SECONDS = 60;

/* ------------------------------------------------------------------ */
/* Local cache                                                        */
/* ------------------------------------------------------------------ */

export async function readCachedDocuments(): Promise<VaultDocument[]> {
  return (await idbGet<VaultDocument[]>(INDEX_KEY)) ?? [];
}

async function writeCachedDocuments(docs: VaultDocument[]): Promise<void> {
  await idbSet(INDEX_KEY, docs);
}

export async function readCachedFile(id: string): Promise<Blob | null> {
  return idbGet<Blob>(BLOB_KEY(id));
}

/* ------------------------------------------------------------------ */
/* Remote sync                                                        */
/* ------------------------------------------------------------------ */

/**
 * Pull the index and every file body into the local cache. Called on login
 * and whenever the vault page opens online.
 */
export async function syncVault(): Promise<VaultDocument[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, type, country_code, expires_on, storage_path, file_name, file_size, mime_type, notes, created_at")
    .order("created_at", { ascending: false });
  if (error || !data) return readCachedDocuments();

  const docs = data as VaultDocument[];
  await writeCachedDocuments(docs);

  // Cache every file body so the vault opens with no connectivity.
  for (const doc of docs) {
    if (await readCachedFile(doc.id)) continue;
    const dl = await supabase.storage.from("documents").download(doc.storage_path);
    if (dl.data) await idbSet(BLOB_KEY(doc.id), dl.data);
  }

  return docs;
}

export type NewDocument = {
  title: string;
  type: DocumentType;
  country_code: string | null;
  expires_on: string | null;
  notes: string;
  file: File;
};

export async function uploadDocument(input: NewDocument): Promise<VaultDocument> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Sign in to add documents to your vault.");

  const safeName = input.file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${userId}/${crypto.randomUUID()}-${safeName}`;

  const up = await supabase.storage
    .from("documents")
    .upload(path, input.file, { contentType: input.file.type || "application/octet-stream" });
  if (up.error) throw up.error;

  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      title: input.title,
      type: input.type,
      country_code: input.country_code,
      expires_on: input.expires_on,
      storage_path: path,
      file_name: input.file.name,
      file_size: input.file.size,
      mime_type: input.file.type || null,
      notes: input.notes,
    })
    .select()
    .single();
  if (error || !data) {
    await supabase.storage.from("documents").remove([path]);
    throw error ?? new Error("Could not save the document.");
  }

  const doc = data as VaultDocument;
  // Cache the file immediately — this copy is what a border check reads.
  await idbSet(BLOB_KEY(doc.id), input.file);
  await writeCachedDocuments([doc, ...(await readCachedDocuments())]);
  return doc;
}

export async function updateDocument(
  id: string,
  patch: Partial<Pick<VaultDocument, "title" | "type" | "country_code" | "expires_on" | "notes">>,
): Promise<void> {
  await supabase.from("documents").update(patch).eq("id", id);
  const docs = await readCachedDocuments();
  await writeCachedDocuments(docs.map((d) => (d.id === id ? { ...d, ...patch } : d)));
}

export async function deleteDocument(doc: VaultDocument): Promise<void> {
  // Storage object first: a deleted row with an orphaned file is the failure
  // mode that matters when the file is a passport scan.
  await supabase.storage.from("documents").remove([doc.storage_path]);
  await supabase.from("documents").delete().eq("id", doc.id);
  await idbDel(BLOB_KEY(doc.id));
  await writeCachedDocuments((await readCachedDocuments()).filter((d) => d.id !== doc.id));
}

/** One-tap wipe. Deletes the storage objects too, not just the rows. */
export async function deleteEverything(): Promise<{ deleted: number }> {
  const docs = await syncVault().catch(() => readCachedDocuments());
  const paths = docs.map((d) => d.storage_path);
  if (paths.length > 0) await supabase.storage.from("documents").remove(paths);
  for (const doc of docs) await idbDel(BLOB_KEY(doc.id));
  const ids = docs.map((d) => d.id);
  if (ids.length > 0) await supabase.from("documents").delete().in("id", ids);
  await writeCachedDocuments([]);
  return { deleted: docs.length };
}

/**
 * A URL to view the file. Prefers the local Blob (works offline, instant);
 * falls back to a short-lived signed URL. Never a public URL.
 */
export async function documentUrl(doc: VaultDocument): Promise<string | null> {
  const blob = await readCachedFile(doc.id);
  if (blob) return URL.createObjectURL(blob);
  const { data } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

/* ------------------------------------------------------------------ */
/* Expiry                                                             */
/* ------------------------------------------------------------------ */

/**
 * Passport validity is the one people underestimate: many countries refuse
 * entry with under six months remaining, so a passport is "expiring" long
 * before it expires. Warn at 12, 6 and 3 months.
 */
export const PASSPORT_WARNING_DAYS = [365, 183, 92] as const;
export const GENERIC_WARNING_DAYS = [90, 30, 7] as const;

export function warningThresholds(type: DocumentType): readonly number[] {
  return type === "passport" ? PASSPORT_WARNING_DAYS : GENERIC_WARNING_DAYS;
}

export type ExpiryState = {
  daysRemaining: number;
  severity: "expired" | "critical" | "warning" | "ok";
  label: string;
};

export function expiryState(doc: VaultDocument, today = todayIso()): ExpiryState | null {
  if (!doc.expires_on) return null;
  const daysRemaining = toDayIndex(doc.expires_on) - toDayIndex(today);
  const [first, second] = warningThresholds(doc.type);

  if (daysRemaining < 0) {
    return { daysRemaining, severity: "expired", label: `Expired ${-daysRemaining} days ago` };
  }
  const months = Math.round(daysRemaining / 30.4);
  const human = daysRemaining < 60 ? `${daysRemaining} days` : `${months} months`;

  if (doc.type === "passport" && daysRemaining < 183) {
    return {
      daysRemaining,
      severity: daysRemaining < 92 ? "critical" : "warning",
      label: `${human} of validity left — many countries refuse entry under six months`,
    };
  }
  if (daysRemaining <= (second ?? 0)) {
    return { daysRemaining, severity: "critical", label: `Expires in ${human}` };
  }
  if (daysRemaining <= (first ?? 0)) {
    return { daysRemaining, severity: "warning", label: `Expires in ${human}` };
  }
  return { daysRemaining, severity: "ok", label: `Valid for ${human}` };
}
