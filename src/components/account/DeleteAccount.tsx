/**
 * Account deletion UI.
 *
 * Apple's Review Guideline 5.1.1(v) requires this to be findable inside the
 * app — not buried, not "email support". GDPR Art. 17 requires it to actually
 * work. Both are satisfied by a plainly labelled section that lists exactly
 * what disappears and then does it.
 *
 * The type-to-confirm step is deliberate. This destroys a passport vault and
 * years of travel history with no undo, and a single mis-tap should not be
 * enough. It is the one place in this app where friction is the correct
 * design.
 */
import { useState } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { deleteAccount } from "@/lib/account/delete-account";
import { downloadExport } from "@/lib/account/export-data";
import { useSession } from "@/lib/use-session";

const CONFIRM_WORD = "DELETE";

export function DeleteAccount() {
  const { signedIn, email } = useSession();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Nothing to delete without an account — trips are device-local until sign-in.
  if (!signedIn) return null;

  async function runExport() {
    setExporting(true);
    setExportError(null);
    try {
      await downloadExport();
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount();
      window.location.href = "/";
    } catch (e) {
      // Never claim success on a partial deletion. Someone told their passport
      // scans are gone has to be right.
      setError(
        e instanceof Error
          ? `${e.message} — nothing was deleted. Please try again or contact us.`
          : "Deletion failed. Nothing was deleted.",
      );
      setBusy(false);
    }
  }

  return (
    <>
      {/*
        Article 20 (portability). Placed immediately above deletion on purpose:
        the moment someone considers leaving is exactly when they should be
        offered their data, not after it is gone.
      */}
      <section className="panel p-4">
        <h2 className="text-sm font-semibold">Download your data</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          A JSON file containing everything we hold: your profile, every trip
          and day count, document details, saved cities, connections and
          referral records. Document files themselves stay in your vault and
          download separately.
        </p>
        <button
          onClick={runExport}
          disabled={exporting}
          className="mt-3 flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/50 hover:bg-surface-2 disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          {exporting ? "Preparing…" : "Download my data"}
        </button>
        {exportError ? (
          <p role="alert" className="mt-2 text-xs text-negative">
            {exportError}
          </p>
        ) : null}
      </section>

    <section className="panel border-negative/40 p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-negative" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Delete your account</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Permanently removes {email ? <span className="text-foreground">{email}</span> : "your account"} and
            everything attached to it: your trips and day counts, every document
            in your vault and the files themselves, your profile, and your radar
            profile and connections. This cannot be undone and we cannot recover
            it for you.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Payout records tied to the creator programme are kept but
            anonymised — accounting rules require us to retain them, and they no
            longer identify you.
          </p>

          {!open ? (
            <button
              onClick={() => setOpen(true)}
              className="mt-3 rounded-md border border-negative/50 px-3 py-1.5 text-xs font-medium text-negative transition-colors hover:bg-negative-muted"
            >
              Delete account
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              <label className="block">
                <span className="text-xs text-foreground">
                  Type <span className="font-semibold">{CONFIRM_WORD}</span> to confirm
                </span>
                <input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-1 w-full max-w-48 rounded-md border border-input bg-surface px-2 py-1.5 text-sm"
                />
              </label>

              {error ? (
                <p role="alert" className="rounded-md bg-negative-muted px-2 py-1.5 text-xs text-negative">
                  {error}
                </p>
              ) : null}

              <div className="flex items-center gap-2">
                <button
                  onClick={run}
                  disabled={confirm !== CONFIRM_WORD || busy}
                  className="rounded-md bg-negative px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                >
                  {busy ? "Deleting…" : "Permanently delete"}
                </button>
                <button
                  onClick={() => {
                    setOpen(false);
                    setConfirm("");
                    setError(null);
                  }}
                  disabled={busy}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
    </>
  );
}
