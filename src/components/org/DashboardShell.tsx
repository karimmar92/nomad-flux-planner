/**
 * The corporate frame around the employer dashboard.
 *
 * Laid out the way an admin expects a business tool to look: a left sidebar
 * with the five places they can go and a count on the ones that need them, a
 * page header that says what this screen is for in one line, and the page's
 * quick actions top right. On a phone the sidebar becomes a scrolling row of
 * pills, so the same five places are one thumb away.
 *
 * It holds no data of its own. Navigation state and the numbers on the badges
 * come from the dashboard, so this can be reused or restyled without touching
 * any of the compliance logic.
 */
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem<T extends string> = {
  id: T;
  label: string;
  icon: LucideIcon;
  /** Count shown on the item, e.g. requests waiting. Zero or undefined hides it. */
  badge?: number | undefined;
  /** Colour of the badge: urgent counts read as an alert, others as information. */
  badgeTone?: "alert" | "info";
  title: string;
  description: string;
};

export function DashboardShell<T extends string>({
  orgName,
  items,
  current,
  onNavigate,
  actions,
  banner,
  children,
}: {
  orgName: string;
  items: NavItem<T>[];
  current: T;
  onNavigate: (id: T) => void;
  /** Quick actions for the page header, top right. */
  actions?: ReactNode;
  /** Full-width notices above the page (sample-data bar, payment confirmation). */
  banner?: ReactNode;
  children: ReactNode;
}) {
  const active = items.find((i) => i.id === current) ?? items[0]!;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 pb-8 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
      <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <div className="mb-3 hidden items-center gap-2.5 lg:flex">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-foreground text-sm font-semibold text-background">
            {orgName.trim().charAt(0).toUpperCase() || "O"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{orgName}</p>
            <p className="text-[11px] text-muted-foreground">Team compliance</p>
          </div>
        </div>

        <nav
          aria-label="Dashboard sections"
          className="hide-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
        >
          {items.map((item) => {
            const selected = item.id === current;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "flex min-h-10 shrink-0 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors",
                  selected
                    ? "bg-surface-2 font-medium text-foreground"
                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                <span className="whitespace-nowrap">{item.label}</span>
                {item.badge ? (
                  <span
                    className={cn(
                      "num ms-auto grid min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-semibold leading-5",
                      item.badgeTone === "alert"
                        ? "bg-negative text-white"
                        : "bg-primary/10 text-primary",
                    )}
                    aria-label={`${item.badge} need attention`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <p className="mt-4 hidden items-start gap-1.5 rounded-lg border border-border p-2.5 text-[11px] leading-relaxed text-muted-foreground lg:flex">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Country and dates only. Employees see exactly this.
        </p>
      </aside>

      <div className="min-w-0 space-y-5">
        {banner}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{active.title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{active.description}</p>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}
