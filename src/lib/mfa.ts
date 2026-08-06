/**
 * Step-up authentication (TOTP) for the document vault.
 *
 * The vault holds passports and IDs, so server access requires aal2 — a
 * session that has completed a second factor. Enforced by RESTRICTIVE RLS
 * policies (supabase/migrations/20260806120000_vault_step_up_mfa.sql); this
 * module is the client half.
 *
 * Deliberate boundary: only SERVER access steps up. The on-device cache stays
 * readable at aal1, because the vault's core promise is opening in an
 * immigration hall with no signal — and a TOTP check needs a connection.
 */
import { supabase } from "@/integrations/supabase/client";

export type StepUpState =
  | "signed-out"
  /** No verified factor yet — must enrol before first vault upload. */
  | "enrol"
  /** Factor exists, session is aal1 — prompt for the 6-digit code. */
  | "challenge"
  /** Session is aal2 — vault is open. */
  | "verified";

export async function getStepUpState(): Promise<StepUpState> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return "signed-out";
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return "signed-out";
  if (data.currentLevel === "aal2") return "verified";
  return data.nextLevel === "aal2" ? "challenge" : "enrol";
}

/** True when the current session may touch vault rows and files remotely. */
export async function hasAal2(): Promise<boolean> {
  return (await getStepUpState()) === "verified";
}

export type TotpEnrolment = {
  factorId: string;
  /** SVG data URI for the authenticator-app QR code. */
  qrCode: string;
  /** Manual-entry fallback for the QR code. */
  secret: string;
};

/**
 * Start TOTP enrolment. Any abandoned unverified factor is removed first —
 * its QR code can never be shown again, so it is dead weight that would make
 * a second attempt fail.
 */
export async function enrolTotp(): Promise<TotpEnrolment> {
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Authenticator app",
  });
  if (error || !data) throw new Error(error?.message ?? "Could not start enrolment.");
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/** Verify a 6-digit code against a factor. Succeeding upgrades the session to aal2. */
export async function verifyTotp(factorId: string, code: string): Promise<void> {
  const { data: challenge, error: chError } = await supabase.auth.mfa.challenge({ factorId });
  if (chError || !challenge) throw new Error(chError?.message ?? "Could not start verification.");
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  });
  if (error) throw new Error("That code didn't match. Codes rotate every 30 seconds — try the current one.");
}

/** The verified TOTP factor to challenge against, if one exists. */
export async function verifiedFactorId(): Promise<string | null> {
  const { data } = await supabase.auth.mfa.listFactors();
  return data?.totp.find((f) => f.status === "verified")?.id ?? null;
}
