import { Link } from "@tanstack/react-router";
import {
  CalendarClock,
  Compass,
  FolderLock,
  Calculator,
  GitCompareArrows,
  Moon,
  Sun,
  Tag,
  UserRound,
} from "lucide-react";
import { AuthButton } from "@/components/AuthButton";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ArrivalGate } from "@/components/arrival/ArrivalGate";
import { APP_NAME } from "@/lib/app";
import { useTheme } from "@/lib/store";
import { useOrgTripSync } from "@/lib/org/use-trip-sync";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type NavItem = { to: string; label: string; icon: typeof Compass };

/**
 * People who have not left yet have no trips, so the tracker and the record
 * layer are empty noise to them. The planning track leads instead, and the
 * tracker reappears at graduation.
 */
const NAV_PLANNING: NavItem[] = [
  { to: "/plan", label: "Plan", icon: PlaneTakeoff },
  { to: "/", label: "Explore", icon: Compass },
  { to: "/calculator", label: "Arbitrage", icon: Calculator },
  { to: "/compare", label: "Compare", icon: GitCompareArrows },
  { to: "/pricing", label: "Pricing", icon: Tag },
];

const NAV_ABROAD: NavItem[] = [
  { to: "/", label: "Explore", icon: Compass },
  { to: "/calculator", label: "Arbitrage", icon: Calculator },
  { to: "/compare", label: "Compare", icon: GitCompareArrows },
  { to: "/tracker", label: "Tracker", icon: CalendarClock },
  { to: "/record", label: "Record", icon: FolderLock },
  { to: "/pricing", label: "Pricing", icon: Tag },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const { profile } = useProfile();
  const NAV = profile.stage === "planning" ? NAV_PLANNING : NAV_ABROAD;
  // Country + dates only, and only for people who are in an organisation.
  useOrgTripSync();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <OfflineBanner />

      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded bg-primary text-[13px] font-bold text-primary-foreground">
              {APP_NAME.charAt(0)}
            </span>
            <span className="text-sm font-semibold tracking-tight">{APP_NAME}</span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                activeProps={{ className: "bg-surface-2 text-foreground" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <AuthButton />
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              to="/profile"
              aria-label="Profile"
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <UserRound className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-5 md:pb-10">
        <ArrivalGate />
        {children}
      </main>

      <div className="mx-auto mb-20 flex w-full max-w-6xl flex-wrap gap-4 px-4 text-xs text-muted-foreground md:mb-6">
        <Link to="/plan" className="hover:text-foreground">
          Before you go
        </Link>
        <Link to="/community" className="hover:text-foreground">
          Community
        </Link>
        <Link to="/stays" className="hover:text-foreground">
          Stays
        </Link>
        <Link to="/profile" className="hover:text-foreground">
          Profile
        </Link>
        <Link to="/setup/company" className="hover:text-foreground">
          Do you need a company?
        </Link>
        <Link to="/kit" className="hover:text-foreground">
          Nomad kit
        </Link>
        <Link to="/business" className="hover:text-foreground">
          For teams
        </Link>
        <Link to="/org" className="hover:text-foreground">
          Team dashboard
        </Link>
        <Link to="/settings/employer-sharing" className="hover:text-foreground">
          Employer sharing
        </Link>
        <Link to="/how-we-make-money" className="hover:text-foreground">
          How we make money
        </Link>
        <Link to="/creators" className="hover:text-foreground">
          Creator programme
        </Link>
        <Link to="/creator" className="hover:text-foreground">
          Creator dashboard
        </Link>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-6 border-t border-border bg-background/95 backdrop-blur md:hidden">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground",
            )}
            activeProps={{ className: "text-primary" }}
            activeOptions={{ exact: item.to === "/" }}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
