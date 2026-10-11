/**
 * Sign-in for Driftly. Also lets external AI clients complete the OAuth
 * consent flow at /.lovable/oauth/consent, so the `next` param must survive
 * every path out of this page.
 *
 * Laid out like the welcome screen of a native app: one column, large touch
 * targets, the platform's preferred provider first (Apple on iPhone and Mac,
 * Google on Android), and email as a one-time code rather than a password.
 * A password stays available behind a link because existing accounts use one.
 *
 * Apple and Google both go through Lovable's managed OAuth, which is already
 * wired in src/integrations/lovable. The email code uses Supabase's own OTP.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { APP_NAME } from "@/lib/app";

function safeNext(raw: unknown): string {
  if (typeof raw !== "string") return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ next: safeNext(s["next"]) }),
  head: () => ({
    meta: [
      { title: `Sign in — ${APP_NAME}` },
      {
        name: "description",
        content:
          "Sign in to Driftly with Apple, Google or an email code to sync your travel record across devices.",
      },
      { property: "og:title", content: `Sign in — ${APP_NAME}` },
      { property: "og:description", content: "Sign in to Driftly." },
    ],
  }),
  component: AuthPage,
});

type Step = "choose" | "code" | "password";
type Busy = "apple" | "google" | "email" | "code" | "password" | null;

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

function AppleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3.01h3.88c2.27-2.09 3.57-5.17 3.57-8.83z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.55.38-2.27V6.62H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l4-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.62l4 3.11C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

function AuthPage() {
  const { next } = Route.useSearch();
  const [step, setStep] = useState<Step>("choose");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Apple first on Apple hardware, Google first on Android. Both always shown.
  const androidFirst = useMemo(
    () => typeof navigator !== "undefined" && /android/i.test(navigator.userAgent),
    [],
  );

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.replace(next);
    });
  }, [next]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const returnUrl = typeof window === "undefined" ? "/" : window.location.origin + next;

  function go(to: Step) {
    setStep(to);
    setError(null);
    setNotice(null);
  }

  async function oauth(provider: "apple" | "google") {
    setError(null);
    setBusy(provider);
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: returnUrl });
    if (result.error) {
      setBusy(null);
      return setError(result.error instanceof Error ? result.error.message : String(result.error));
    }
    if (result.redirected) return;
    window.location.replace(next);
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setNotice(null);
    setBusy("email");
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: returnUrl, shouldCreateUser: true },
    });
    setBusy(null);
    if (err) return setError(err.message);
    setCode("");
    setCooldown(RESEND_SECONDS);
    setStep("code");
  }

  async function verifyCode(value: string) {
    setError(null);
    setBusy("code");
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: value,
      type: "email",
    });
    if (err) {
      setBusy(null);
      setCode("");
      return setError("That code didn’t work. Check it and try again, or request a new one.");
    }
    // `next` routinely carries a query string (?plan=pro&checkout=1). A full
    // document navigation preserves the purchase intent exactly.
    window.location.assign(next);
  }

  function onCodeChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH) void verifyCode(digits);
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy("password");
    setError(null);
    setNotice(null);
    if (mode === "signup") {
      const { error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: returnUrl },
      });
      setBusy(null);
      if (err) return setError(err.message);
      setNotice("Check your email to confirm your account, then come back here.");
      return;
    }
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(null);
    if (err) return setError(err.message);
    window.location.assign(next);
  }

  const apple = (
    <button
      key="apple"
      type="button"
      onClick={() => void oauth("apple")}
      disabled={busy !== null}
      className="auth-btn bg-foreground text-background hover:opacity-90"
    >
      <AppleMark className="h-5 w-5 -translate-y-px" />
      {busy === "apple" ? "Opening Apple…" : "Continue with Apple"}
    </button>
  );
  const google = (
    <button
      key="google"
      type="button"
      onClick={() => void oauth("google")}
      disabled={busy !== null}
      className="auth-btn border border-border bg-card text-foreground hover:bg-surface-2"
    >
      <GoogleMark className="h-5 w-5" />
      {busy === "google" ? "Opening Google…" : "Continue with Google"}
    </button>
  );

  return (
    <div className="pt-safe pb-safe relative flex min-h-screen flex-col overflow-hidden">
      {/* One soft wash behind the mark, the way an app's welcome screen has a
          single light source. Decorative; never intercepts a tap. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] opacity-70"
        style={{
          background:
            "radial-gradient(60% 70% at 50% 0%, color-mix(in oklch, var(--primary) 14%, transparent), transparent 70%)",
        }}
      />

      <div className="px-safe relative mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center py-10">
        {step !== "choose" ? (
          <button
            type="button"
            onClick={() => go("choose")}
            className="-ms-2 mb-6 inline-flex min-h-11 w-fit items-center gap-0.5 rounded-lg px-2 text-[1.0625rem] text-primary"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
            Back
          </button>
        ) : null}

        <header className="mb-8 text-center">
          <img
            src="/icons/icon-192.png"
            alt=""
            width={72}
            height={72}
            className="mx-auto mb-6 h-[72px] w-[72px] rounded-[1.375rem] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.35)]"
          />
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.03em]">
            {step === "code"
              ? "Check your email"
              : step === "password"
                ? mode === "signin"
                  ? "Sign in with a password"
                  : "Create your account"
                : `Welcome to ${APP_NAME}`}
          </h1>
          <p className="mt-2 text-[1.0625rem] leading-snug text-muted-foreground">
            {step === "code" ? (
              <>
                We sent a 6-digit code to <span className="text-foreground">{email.trim()}</span>.
              </>
            ) : step === "password" ? (
              "Use the email and password you signed up with."
            ) : (
              "Your travel record, day counts and team compliance, synced across your devices."
            )}
          </p>
        </header>

        {step === "choose" ? (
          <div className="space-y-3">
            {androidFirst ? [google, apple] : [apple, google]}

            <div className="flex items-center gap-3 py-2 text-[0.8125rem] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={sendCode} className="space-y-3">
              <label className="sr-only" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email webauthn"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-[3.25rem] w-full rounded-[0.875rem] border border-input bg-card px-4 text-[1.0625rem] outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_18%,transparent)]"
              />
              <button
                type="submit"
                disabled={busy !== null || email.trim() === ""}
                className="auth-btn bg-primary text-primary-foreground hover:opacity-90"
              >
                <Mail className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                {busy === "email" ? "Sending code…" : "Continue with email"}
              </button>
            </form>

            {error ? (
              <p role="alert" className="pt-1 text-center text-[0.9375rem] text-negative">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => go("password")}
              className="mx-auto mt-2 block min-h-11 px-3 text-[0.9375rem] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Use a password instead
            </button>
          </div>
        ) : null}

        {step === "code" ? (
          <div className="space-y-4">
            <label className="sr-only" htmlFor="code">
              6-digit code
            </label>
            <input
              id="code"
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={CODE_LENGTH}
              placeholder="000000"
              value={code}
              disabled={busy === "code"}
              onChange={(e) => onCodeChange(e.target.value)}
              className="num h-16 w-full rounded-[0.875rem] border border-input bg-card text-center text-[2rem] tracking-[0.5em] outline-none transition-shadow placeholder:text-muted-foreground/40 focus:border-primary focus:shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_18%,transparent)] disabled:opacity-60"
            />

            {busy === "code" ? (
              <p className="text-center text-[0.9375rem] text-muted-foreground" aria-live="polite">
                Signing you in…
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-center text-[0.9375rem] text-negative">
                {error}
              </p>
            ) : null}

            <p className="text-center text-[0.875rem] leading-relaxed text-muted-foreground">
              Enter the code, or open the link in the same email on this device.
            </p>

            <div className="flex items-center justify-center gap-5 text-[0.9375rem]">
              <button
                type="button"
                onClick={() => void sendCode()}
                disabled={cooldown > 0 || busy !== null}
                className="min-h-11 text-primary disabled:text-muted-foreground"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
              <button
                type="button"
                onClick={() => go("choose")}
                className="min-h-11 text-muted-foreground hover:text-foreground"
              >
                Wrong email?
              </button>
            </div>
          </div>
        ) : null}

        {step === "password" ? (
          <form onSubmit={submitPassword} className="space-y-3">
            <label className="sr-only" htmlFor="pw-email">
              Email address
            </label>
            <input
              id="pw-email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              required
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-[3.25rem] w-full rounded-[0.875rem] border border-input bg-card px-4 text-[1.0625rem] outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_18%,transparent)]"
            />
            <label className="sr-only" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={8}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-[3.25rem] w-full rounded-[0.875rem] border border-input bg-card px-4 text-[1.0625rem] outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_18%,transparent)]"
            />
            {error ? (
              <p role="alert" className="text-center text-[0.9375rem] text-negative">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="text-center text-[0.9375rem] text-muted-foreground">{notice}</p>
            ) : null}
            <button
              type="submit"
              disabled={busy !== null}
              className="auth-btn bg-primary text-primary-foreground hover:opacity-90"
            >
              {busy === "password" ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
            <div className="flex flex-col items-center gap-0.5 pt-1 text-[0.9375rem]">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setError(null);
                  setNotice(null);
                }}
                className="min-h-11 px-3 text-muted-foreground hover:text-foreground"
              >
                {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
              </button>
              {mode === "signin" ? (
                <button
                  type="button"
                  onClick={() => void sendCode()}
                  disabled={busy !== null || email.trim() === ""}
                  className="min-h-11 px-3 text-primary disabled:text-muted-foreground"
                >
                  Forgot your password? Email me a code
                </button>
              ) : null}
            </div>
          </form>
        ) : null}

        <footer className="mt-10 space-y-3 text-center text-[0.8125rem] leading-relaxed text-muted-foreground">
          {step === "choose" ? (
            <Link to="/tracker" className="block text-[0.9375rem] text-primary">
              Continue without an account
            </Link>
          ) : null}
          <p>
            By continuing you agree to the{" "}
            <Link to="/legal/terms" className="underline underline-offset-2">
              Terms
            </Link>{" "}
            and{" "}
            <Link to="/legal/privacy" className="underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
        </footer>
      </div>
    </div>
  );
}
