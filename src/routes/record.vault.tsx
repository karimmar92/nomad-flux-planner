import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, FileWarning, Lock, Trash2, Upload } from "lucide-react";
import { APP_NAME } from "@/lib/app";
import { useVault } from "@/lib/documents/use-vault";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  deleteDocument,
  deleteEverything,
  documentUrl,
  expiryState,
  uploadDocument,
  type DocumentType,
  type VaultDocument,
} from "@/lib/documents/vault";
import { CITIES } from "@/lib/cities";
import { useOnline } from "@/lib/offline/use-online";
import { useSession } from "@/lib/use-session";
import { useProfile } from "@/lib/store";
import { isPro } from "@/lib/entitlements";
import { ProPrompt } from "@/components/ProGate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/record/vault")({
  head: () => ({
    meta: [
      { title: `Document vault | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Passport, visa approvals and insurance certificates, private to you and cached on your device so they open with no signal.",
      },
      { property: "og:title", content: `Document vault | ${APP_NAME}` },
      {
        property: "og:description",
        content: "Your travel documents, private and available offline.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VaultPage,
});

const COUNTRIES = Array.from(new Set(CITIES.map((c) => c.country_code))).sort();

function VaultPage() {
  const { documents, refresh, setDocuments } = useVault();
  const { signedIn } = useSession();
  const { profile } = useProfile();
  const pro = isPro(profile.plan);
  const online = useOnline();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const expiring = documents
    .map((d) => ({ doc: d, state: expiryState(d) }))
    .filter((x) => x.state && x.state.severity !== "ok");

  return (
    <div className="space-y-5">
      <Link
        to="/record"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Your record
      </Link>

      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Document vault</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Files are stored in a private bucket only your account can read, and a copy is kept on this
          device so the vault opens in an immigration hall with no signal.
        </p>
        <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" aria-hidden />
          No public links are ever created. Remote reads use a one-minute signed URL.
        </p>
      </header>

      {expiring.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Approaching expiry</h2>
          {expiring.map(({ doc, state }) => (
            <div
              key={doc.id}
              className={cn(
                "panel flex items-start gap-2 border-s-2 p-3",
                state!.severity === "expired" || state!.severity === "critical"
                  ? "border-s-accent-warning bg-accent-warning/5"
                  : "border-s-accent-warning/50",
              )}
            >
              <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-accent-warning" aria-hidden />
              <div>
                <div className="text-sm font-medium">{doc.title}</div>
                <div className="text-xs text-muted-foreground">{state!.label}</div>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {!pro ? (
        <ProPrompt
          title="The vault is Pro"
          body="Passport, visa approvals and insurance certificates in a private bucket, cached on this device so they open with no signal. Trip logging stays free forever."
        />
      ) : !signedIn ? (
        <div className="panel p-4 text-sm text-muted-foreground">
          <Link to="/auth" search={{ next: "/record/vault" }} className="underline">
            Sign in
          </Link>{" "}
          to store documents. They are encrypted at rest and readable only by your account.
        </div>
      ) : (
        <UploadForm
          disabled={!online}
          onError={setError}
          onAdded={() => void refresh()}
        />
      )}

      {!online ? (
        <p className="text-xs text-muted-foreground">
          Offline: existing documents open normally from this device. New uploads need a connection.
        </p>
      ) : null}
      {error ? <p className="text-xs text-accent-warning">{error}</p> : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Stored documents</h2>
        {documents.length === 0 ? (
          <div className="panel p-4 text-sm text-muted-foreground">
            Nothing stored yet. A passport scan and your current visa approval are the two worth
            adding first.
          </div>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                onDeleted={() => setDocuments((prev) => prev.filter((d) => d.id !== doc.id))}
              />
            ))}
          </ul>
        )}
      </section>

      {documents.length > 0 && signedIn ? (
        <button
          className="btn text-accent-warning"
          disabled={busy}
          onClick={async () => {
            if (!confirm("Delete every document and its stored file? This cannot be undone.")) return;
            setBusy(true);
            try {
              await deleteEverything();
              setDocuments([]);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Trash2 className="me-1.5 h-3.5 w-3.5" aria-hidden />
          Delete everything
        </button>
      ) : null}
    </div>
  );
}

function UploadForm({
  disabled,
  onAdded,
  onError,
}: {
  disabled: boolean;
  onAdded: () => void;
  onError: (message: string | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<DocumentType>("passport");
  const [country, setCountry] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    onError(null);
    setBusy(true);
    try {
      await uploadDocument({
        title: title.trim() || file.name,
        type,
        country_code: country || null,
        expires_on: expiresOn || null,
        notes: notes.trim(),
        file,
      });
      setFile(null);
      setTitle("");
      setExpiresOn("");
      setNotes("");
      onAdded();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="panel grid gap-3 p-4 sm:grid-cols-2">
      <label className="space-y-1 text-xs sm:col-span-2">
        <span className="text-muted-foreground">File</span>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="input"
        />
      </label>

      <label className="space-y-1 text-xs">
        <span className="text-muted-foreground">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="UK passport"
          className="input"
        />
      </label>

      <label className="space-y-1 text-xs">
        <span className="text-muted-foreground">Type</span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as DocumentType)}
          className="input"
        >
          {DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {DOCUMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-xs">
        <span className="text-muted-foreground">Country (optional)</span>
        <select value={country} onChange={(e) => setCountry(e.target.value)} className="input">
          <option value="">—</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-xs">
        <span className="text-muted-foreground">Expires on (optional)</span>
        <input
          type="date"
          value={expiresOn}
          onChange={(e) => setExpiresOn(e.target.value)}
          className="input num"
        />
      </label>

      <label className="space-y-1 text-xs sm:col-span-2">
        <span className="text-muted-foreground">Notes</span>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Reference number, issuing office"
          className="input"
        />
      </label>

      <div className="sm:col-span-2">
        <button type="submit" className="btn-primary" disabled={!file || busy || disabled}>
          <Upload className="me-1.5 h-3.5 w-3.5" aria-hidden />
          {busy ? "Uploading…" : "Add to vault"}
        </button>
      </div>
    </form>
  );
}

function DocumentRow({ doc, onDeleted }: { doc: VaultDocument; onDeleted: () => void }) {
  const state = expiryState(doc);
  const [busy, setBusy] = useState(false);

  async function open() {
    const url = await documentUrl(doc);
    if (url) window.open(url, "_blank", "noopener");
  }

  return (
    <li className="panel flex flex-wrap items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium">{doc.title}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {DOCUMENT_TYPE_LABELS[doc.type]}
          </span>
          {doc.country_code ? (
            <span className="num text-[11px] text-muted-foreground">{doc.country_code}</span>
          ) : null}
        </div>
        <div className="num text-[11px] text-muted-foreground">
          {doc.file_name}
          {state ? (
            <>
              {" · "}
              <span className={state.severity === "ok" ? "" : "text-accent-warning"}>
                {state.label}
              </span>
            </>
          ) : null}
        </div>
        {doc.notes ? <p className="text-[11px] text-muted-foreground">{doc.notes}</p> : null}
      </div>
      <button onClick={open} className="btn">
        Open
      </button>
      <button
        className="btn text-accent-warning"
        disabled={busy}
        onClick={async () => {
          if (!confirm(`Delete “${doc.title}” and its stored file?`)) return;
          setBusy(true);
          try {
            await deleteDocument(doc);
            onDeleted();
          } finally {
            setBusy(false);
          }
        }}
        aria-label={`Delete ${doc.title}`}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </button>
    </li>
  );
}
