/**
 * Shared shell for legal pages.
 *
 * Deliberately plain: narrow measure, generous line height, no cards or
 * decoration. Legal text is read by people who are worried or in a dispute,
 * and by regulators — both want it legible and boring, not designed.
 *
 * Every legal page also links to every other one. Someone who lands on the
 * refund policy from a Stripe receipt should reach the imprint without going
 * back to the app.
 */
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LEGAL_LAST_UPDATED } from "@/config/legal";

const LEGAL_LINKS = [
  { to: "/legal/imprint", label: "Imprint" },
  { to: "/legal/terms", label: "Terms" },
  { to: "/legal/privacy", label: "Privacy" },
  { to: "/legal/refunds", label: "Refunds & withdrawal" },
  { to: "/legal/cookies", label: "Cookies" },
] as const;

export function LegalPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-16 pt-4">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </header>

      <div className="space-y-8">{children}</div>

      <footer className="space-y-3 border-t border-border pt-6">
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="text-muted-foreground hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-muted-foreground">Last updated: {LEGAL_LAST_UPDATED}</p>
      </footer>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
