import { Link } from "@tanstack/react-router";
import {
  CalendarClock,
  Compass,
  FolderLock,
  Calculator,
  GitCompareArrows,
  Moon,
  Sun,
  UserRound,
  PlaneTakeoff,
  Route as RouteIcon,
  MoreHorizontal,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { AuthButton } from "@/components/AuthButton";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ArrivalGate } from "@/components/arrival/ArrivalGate";
import { APP_NAME } from "@/lib/app";
import { RULE_PAGES, ruleLabel } from "@/config/rule-pages";
import { useProfile, useTheme } from "@/lib/store";
import { useOrgTripSync } from "@/lib/org/use-trip-sync";
import { usePlanSync } from "@/lib/billing/use-plan-sync";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";

type NavItem = { to: string; labelKey: string; icon: typeof Compass };
type NavGroup = { label: string; items: NavItem[] };

/**
 * NAVIGATION — grouped by JOB, not by feature.
 *
 * Desktop: stage-aware groups (planning vs abroad).
 * Mobile: fixed primary chrome — Tracker · Hops · Explore · More — so the bar
 * never exceeds four tappable targets. Secondary destinations live in More.
 *
 * Hops is always present: multi-city routing is useful both while planning a
 * first move and while already abroad (visa runs, next-city hops).
 *
 * Pricing is NOT in the primary nav for signed-in users.
 */
const NAV_PLANNING: NavGroup[] = [
  {
    label: "Plan",
    items: [
      { to: "/plan", labelKey: "nav.plan", icon: PlaneTakeoff },
      { to: "/hops", labelKey: "nav.hops", icon: RouteIcon },
      { to: "/explore", labelKey: "nav.explore", icon: Compass },
    ],
  },
  {
    label: "Decide",
    items: [
      { to: "/calculator", labelKey: "nav.arbitrage", icon: Calculator },
      { to: "/compare", labelKey: "nav.compare", icon: GitCompareArrows },
    ],
  },
];

const NAV_ABROAD: NavGroup[] = [
  {
    label: "Compliance",
    items: [
      { to: "/tracker", labelKey: "nav.tracker", icon: CalendarClock },
      { to: "/record", labelKey: "nav.record", icon: FolderLock },
    ],
  },
  {
    label: "Decide",
    items: [
      { to: "/hops", labelKey: "nav.hops", icon: RouteIcon },
      { to: "/explore", labelKey: "nav.explore", icon: Compass },
      { to: "/calculator", labelKey: "nav.arbitrage", icon: Calculator },
    ],
  },
];

/** Fixed mobile primary bar — max 4 targets for thumb accuracy. */
const MOBILE_PRIMARY: NavItem[] = [
  { to: "/tracker", labelKey: "nav.tracker", icon: CalendarClock },
  { to: "/hops", labelKey: "nav.hops", icon: RouteIcon },
  { to: "/explore", labelKey: "nav.explore", icon: Compass },
];

const MOBILE_MORE: NavItem[] = [
  { to: "/record", labelKey: "nav.record", icon: FolderLock },
  { to: "/plan", labelKey: "nav.plan", icon: PlaneTakeoff },
  { to: "/calculator", labelKey: "nav.arbitrage", icon: Calculator },
  { to: "/compare", labelKey: "nav.compare", icon: GitCompareArrows },
  { to: "/profile", labelKey: "nav.profile", icon: UserRound },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation("common");
  const { theme, toggleTheme } = useTheme();
  const { profile } = useProfile();
  const [moreOpen, setMoreOpen] = useState(false);
  const NAV_GROUPS = profile.stage === "planning" ? NAV_PLANNING : NAV_ABROAD;

  useOrgTripSync();
  usePlanSync();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <OfflineBanner />

      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-primary">{APP_NAME}</span>
          </Link>

          <nav className="ms-4 hidden items-center gap-1 md:flex">
            {NAV_GROUPS.map((group, gi) => (
              <div key={group.label} className="flex items-center gap-1">
                {gi > 0 ? <span className="mx-1 h-4 w-px bg-border" aria-hidden /> : null}
                {group.items.map((item) => (
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
              </div>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-1">
            <AuthButton />
            <LanguageSwitcher />
            <button
              type="button"
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

      <footer className="mx-auto mb-20 w-full max-w-6xl px-4 pt-8 text-xs text-muted-foreground md:mb-6">
        <div className="grid gap-6 border-t border-border pt-6 sm:grid-cols-2 lg:grid-cols-5">
          <FooterColumn title={t("footerGroups.rules")}>
            <FooterLink to="/rules">All rules</FooterLink>
            {RULE_PAGES.map((r) => (
              <li key={r.slug}>
                <Link
                  to="/rules/$slug"
                  params={{ slug: r.slug }}
                  className="transition-colors hover:text-foreground"
                >
                  {ruleLabel(r)}
                </Link>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title={t("footerGroups.product")}>
            <FooterLink to="/tracker">{t("nav.tracker")}</FooterLink>
            <FooterLink to="/explore">{t("nav.explore")}</FooterLink>
            <FooterLink to="/hops">{t("nav.hops")}</FooterLink>
            <FooterLink to="/calculator">{t("nav.arbitrage")}</FooterLink>
            <FooterLink to="/plan">{t("footerLinks.beforeYouGo")}</FooterLink>
            <FooterLink to="/pricing">{t("nav.pricing")}</FooterLink>
          </FooterColumn>

          <FooterColumn title={t("footerGroups.yourRecord")}>
            <FooterLink to="/record">{t("nav.record")}</FooterLink>
            <FooterLink to="/phrasebook">{t("footerLinks.phrasebook")}</FooterLink>
            <FooterLink to="/pension">{t("footerLinks.pension")}</FooterLink>
            <FooterLink to="/kit">{t("footerLinks.kit")}</FooterLink>
            <FooterLink to="/community">{t("footerLinks.community")}</FooterLink>
            <FooterLink to="/stays">{t("footerLinks.stays")}</FooterLink>
            <FooterLink to="/profile">{t("footerLinks.profile")}</FooterLink>
          </FooterColumn>

          <FooterColumn title={t("footerGroups.forBusiness")}>
            <FooterLink to="/business">{t("footerLinks.business")}</FooterLink>
            <FooterLink to="/org">{t("footerLinks.org")}</FooterLink>
            <FooterLink to="/setup/company">{t("footerLinks.company")}</FooterLink>
            <FooterLink to="/settings/employer-sharing">
              {t("footerLinks.employerSharing")}
            </FooterLink>
          </FooterColumn>

          <FooterColumn title={t("footerGroups.company")}>
            <FooterLink to="/creators">{t("footerLinks.creatorProgramme")}</FooterLink>
            <FooterLink to="/creator">{t("footerLinks.creatorDashboard")}</FooterLink>
            <FooterLink to="/reviews">Customer reviews</FooterLink>
            <FooterLink to="/how-we-make-money">{t("footerLinks.howWeMakeMoney")}</FooterLink>
          </FooterColumn>
        </div>

        <div className="mt-6 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-4">
          <Link to="/legal/imprint" className="transition-colors hover:text-foreground">
            {t("footerLinks.imprint")}
          </Link>
          <Link to="/legal/terms" className="transition-colors hover:text-foreground">
            {t("footerLinks.terms")}
          </Link>
          <Link to="/legal/privacy" className="transition-colors hover:text-foreground">
            {t("footerLinks.privacy")}
          </Link>
          <Link to="/legal/refunds" className="transition-colors hover:text-foreground">
            {t("footerLinks.refunds")}
          </Link>
          <Link to="/legal/cookies" className="transition-colors hover:text-foreground">
            {t("footerLinks.cookies")}
          </Link>
        </div>

        <p className="mt-4 text-[11px]">
          {APP_NAME} produces a record of your travel. It does not determine your visa or tax status
          — confirm both with official sources or a qualified adviser.
        </p>
      </footer>

      {/* Mobile more sheet */}
      {moreOpen ? (
        <>
          <button
            type="button"
            aria-label={t("actions.close")}
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setMoreOpen(false)}
          />
          <div className="fixed inset-x-3 bottom-20 z-50 rounded-2xl border border-border bg-card p-2 shadow-lg md:hidden">
            {MOBILE_MORE.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-surface-2"
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                {t(item.labelKey)}
              </Link>
            ))}
            <Link
              to="/pricing"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface-2"
            >
              {t("nav.pricing")}
            </Link>
          </div>
        </>
      ) : null}

      {/* Mobile primary: Tracker · Hops · Explore · More */}
      <nav className="fixed inset-x-3 bottom-3 z-30 flex rounded-2xl border border-border bg-card/95 px-1 py-1.5 shadow-[0_6px_24px_rgba(0,0,0,0.10)] backdrop-blur md:hidden">
        {MOBILE_PRIMARY.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setMoreOpen(false)}
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
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          className={cn(
            "flex flex-1 flex-col items-center gap-1 rounded-xl py-1 text-[10px] text-muted-foreground",
            moreOpen && "font-medium text-primary",
          )}
          aria-expanded={moreOpen}
          aria-label={t("nav.more")}
        >
          <span
            className={cn(
              "grid h-7 w-7 place-items-center rounded-full",
              moreOpen && "bg-primary/10",
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
          </span>
          {t("nav.more")}
        </button>
      </nav>
    </div>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="label-xs mb-2">{title}</div>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <li>
      <Link to={to} className="transition-colors hover:text-foreground">
        {children}
      </Link>
    </li>
  );
}
