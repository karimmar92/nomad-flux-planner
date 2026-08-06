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
  PlaneTakeoff,
} from "lucide-react";
import { AuthButton } from "@/components/AuthButton";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ArrivalGate } from "@/components/arrival/ArrivalGate";
import { APP_NAME } from "@/lib/app";
import { useProfile, useTheme } from "@/lib/store";
import { useOrgTripSync } from "@/lib/org/use-trip-sync";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";

type NavItem = { to: string; labelKey: string; icon: typeof Compass };

/**
 * People who have not left yet have no trips, so the tracker and the record
 * layer are empty noise to them. The planning track leads instead, and the
 * tracker reappears at graduation.
 */
const NAV_PLANNING: NavItem[] = [
  { to: "/plan", labelKey: "nav.plan", icon: PlaneTakeoff },
  { to: "/", labelKey: "nav.explore", icon: Compass },
  { to: "/calculator", labelKey: "nav.arbitrage", icon: Calculator },
  { to: "/compare", labelKey: "nav.compare", icon: GitCompareArrows },
  { to: "/pricing", labelKey: "nav.pricing", icon: Tag },
];

const NAV_ABROAD: NavItem[] = [
  { to: "/", labelKey: "nav.explore", icon: Compass },
  { to: "/calculator", labelKey: "nav.arbitrage", icon: Calculator },
  { to: "/compare", labelKey: "nav.compare", icon: GitCompareArrows },
  { to: "/tracker", labelKey: "nav.tracker", icon: CalendarClock },
  { to: "/record", labelKey: "nav.record", icon: FolderLock },
  { to: "/pricing", labelKey: "nav.pricing", icon: Tag },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation("common");
  const { theme, toggleTheme } = useTheme();
  const { profile } = useProfile();
  const NAV = profile.stage === "planning" ? NAV_PLANNING : NAV_ABROAD;
  // Country + dates only, and only for people who are in an organisation.
  useOrgTripSync();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <OfflineBanner />

      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-primary">{APP_NAME}</span>
          </Link>


          <nav className="ms-4 hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                activeProps={{ className: "bg-surface-2 text-foreground" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-1">
            <AuthButton />
            <LanguageSwitcher />
            <button
              onClick={toggleTheme}
              aria-label={t("nav.toggleTheme")}
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              to="/profile"
              aria-label={t("nav.profile")}
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
          {t("footerLinks.beforeYouGo")}
        </Link>
        <Link to="/community" className="hover:text-foreground">
          {t("footerLinks.community")}
        </Link>
        <Link to="/stays" className="hover:text-foreground">
          {t("footerLinks.stays")}
        </Link>
        <Link to="/profile" className="hover:text-foreground">
          {t("footerLinks.profile")}
        </Link>
        <Link to="/setup/company" className="hover:text-foreground">
          {t("footerLinks.company")}
        </Link>
        <Link to="/kit" className="hover:text-foreground">
          {t("footerLinks.kit")}
        </Link>
        <Link to="/business" className="hover:text-foreground">
          {t("footerLinks.business")}
        </Link>
        <Link to="/org" className="hover:text-foreground">
          {t("footerLinks.org")}
        </Link>
        <Link to="/settings/employer-sharing" className="hover:text-foreground">
          {t("footerLinks.employerSharing")}
        </Link>
        {/*
          TEMPORARY. The landing page belongs at "/" for logged-out visitors,
          with Explore moving elsewhere — that is a routing decision, not a
          footer link. This exists so the page is reachable for review before
          that call is made. Remove it once the root route is settled.
        */}
        <Link to="/landing" className="hover:text-foreground">
          Landing (preview)
        </Link>
        <Link to="/how-we-make-money" className="hover:text-foreground">
          {t("footerLinks.howWeMakeMoney")}
        </Link>
        <Link to="/creators" className="hover:text-foreground">
          {t("footerLinks.creatorProgramme")}
        </Link>
        <Link to="/creator" className="hover:text-foreground">
          {t("footerLinks.creatorDashboard")}
        </Link>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-30 flex rounded-2xl border border-border bg-card/95 px-1 py-1.5 shadow-[0_6px_24px_rgba(0,0,0,0.10)] backdrop-blur md:hidden">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-xl py-1 text-[10px] text-muted-foreground",
            )}
            activeProps={{ className: "text-primary font-medium [&>span]:bg-primary/10" }}
            activeOptions={{ exact: item.to === "/" }}
          >
            <span className="grid h-7 w-7 place-items-center rounded-full">
              <item.icon className="h-4 w-4" />
            </span>
            {t(item.labelKey)}
          </Link>

        ))}
      </nav>
    </div>
  );
}
