/**
 * Step-up gate for vault server access. Three states: enrol (first time,
 * shows the QR code), challenge (factor exists, asks for the current code),
 * verified (renders children). Signed-out is the caller's problem — the vault
 * route already handles it.
 *
 * Only wraps SERVER interactions (uploads, remote sync). Cached documents
 * render outside this gate so the vault still opens with no signal.
 */
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  enrolTotp,
  getStepUpState,
  verifiedFactorId,
  verifyTotp,
  type StepUpState,
  type TotpEnrolment,
} from "@/lib/mfa";

export function StepUpGate({
  children,
  onVerified,
}: {
  children: React.ReactNode;
  onVerified?: () => void;
}) {
  const [state, setState] = useState<StepUpState | "loading">("loading");
  const [enrolment, setEnrolment] = useState<TotpEnrolment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getStepUpState().then(setState);
  }, []);

  useEffect(() => {
    if (state === "enrol" && !enrolment) {
      enrolTotp()
        .then(setEnrolment)
        .catch((e: Error) => setError(e.message));
    }
  }, [state, enrolment]);

  if (state === "loading") return null;
  if (state === "verified" || state === "signed-out") return <>{children}</>;

  const submit = async () => {
    if (code.length < 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const factorId =
        state === "enrol" ? enrolment?.factorId : await verifiedFactorId();
      if (!factorId) throw new Error("No authenticator is set up for this account.");
      await verifyTotp(factorId, code);
      setState("verified");
      onVerified?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setBusy(false);
      setCode("");
    }
  };

  return (
    <div className="panel space-y-3 p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold">
          {state === "enrol" ? "Protect your vault" : "Verify it's you"}
        </h2>
      </div>

      {state === "enrol" ? (
        <>
          <p className="text-sm text-muted-foreground">
            The vault holds your passport and ID, so it needs more than a password. Scan this
            QR code with an authenticator app (Google Authenticator, 1Password, Aegis…), then
            enter the 6-digit code it shows. You&apos;ll only be asked for a code when you open
            the vault — nowhere else.
          </p>
          {enrolment ? (
            <div className="flex flex-wrap items-center gap-4">
              <img
                src={enrolment.qrCode}
                alt="Authenticator QR code"
                className="h-36 w-36 rounded-md bg-white p-1.5"
              />
              <div className="text-xs text-muted-foreground">
                Can&apos;t scan? Enter this key manually:
                <div className="num mt-1 select-all break-all rounded bg-surface px-2 py-1">
                  {enrolment.secret}
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Enter the current 6-digit code from your authenticator app to open the vault. Documents
          already saved on this device stay available offline without a code.
        </p>
      )}

      <div className="flex items-center gap-2">
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          placeholder="000000"
          className="num w-32 rounded-md border border-input bg-surface px-3 py-2 text-center text-lg font-semibold tracking-widest outline-none focus:border-primary"
        />
        <button
          onClick={() => void submit()}
          disabled={code.length < 6 || busy}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Checking…" : "Verify"}
        </button>
      </div>
      {error ? <p className="text-xs text-accent-warning">{error}</p> : null}
    </div>
  );
}
