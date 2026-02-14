// src/components/AppShell.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { logout, hasPerm, isImpersonating, getCurrentUser } from "../api";

import {
  LayoutDashboard,
  ClipboardList,
  Layout,
  Wrench,
  Factory,
  MapPin,
  CalendarCheck,
  Package,
  Calendar,
  BarChart3,
  Sparkles,
  Users,
  IdCard,
  UserCog,
  ShieldCheck,
  Settings,
  LogOut
} from "lucide-react";

type NavItem = { to: string; label: string; icon: React.ElementType; perm?: string };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Tablou de bord", icon: LayoutDashboard, perm: "DASHBOARD_VIEW" },
  { to: "/work-orders", label: "Ordine de Lucru", icon: ClipboardList, perm: "WO_READ" },
  { to: "/work-orders/cards", label: "Carduri Ordine de Lucru", icon: Layout, perm: "WO_READ" },
  { to: "/extra-jobs", label: "Activitati Extra", icon: Wrench, perm: "EXTRA_READ" },
  { to: "/assets", label: "Utilaje", icon: Factory, perm: "ASSET_READ" },
  { to: "/locations", label: "Locatii", icon: MapPin, perm: "LOC_READ" },
  { to: "/pm-plans", label: "Planuri Mentenanta", icon: CalendarCheck, perm: "PM_READ" },
  { to: "/procurement", label: "Achizitii & Stoc", icon: Package, perm: "INV_READ" },
  { to: "/calendar", label: "Calendar", icon: Calendar, perm: "CALENDAR_READ" },
  { to: "/reports", label: "Rapoarte", icon: BarChart3, perm: "REPORTS_VIEW" },
  { to: "/ai-copilot", label: "AI Copilot", icon: Sparkles, perm: "AI_COPILOT_VIEW" },

  // Admin
  { to: "/people", label: "Angajati", icon: Users, perm: "PEOPLE_READ" },
  { to: "/roles", label: "Pozitii/Roluri master", icon: IdCard, perm: "SETTINGS_READ" },

  // Security
  { to: "/security/users", label: "Acces Utilizatori", icon: UserCog, perm: "SECURITY_USERS_READ" },
  { to: "/security/roles", label: "Configurare Roluri", icon: ShieldCheck, perm: "SECURITY_ROLES_READ" },

  { to: "/settings", label: "Setari", icon: Settings, perm: "SETTINGS_READ" },
];

function cx(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function IconHamburger(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={props.className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

function IconX(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={props.className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6l-12 12" />
    </svg>
  );
}

function Sidebar(props: {
  title?: string;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  const loc = useLocation();

  const filteredNav = useMemo(() => {
    return NAV.filter(it => !it.perm || hasPerm(it.perm));
  }, []);

  return (
    <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.35)] flex flex-col">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Navigare
      </div>

      <nav className="space-y-1 p-1 flex-1">
        {filteredNav.map((it) => {
          const active =
            loc.pathname === it.to || loc.pathname.startsWith(it.to + "/");
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              onClick={props.onNavigate}
              className={cx(
                "flex items-center rounded-xl px-3 py-2 text-sm transition",
                active
                  ? "bg-teal-500/15 text-teal-200 ring-1 ring-teal-400/30"
                  : "text-zinc-200 hover:bg-white/10"
              )}
            >
              <Icon className={cx("mr-3 h-4 w-4 shrink-0", active ? "text-teal-400" : "text-zinc-400")} />
              {it.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-3 border-t border-white/10 p-2">
        <button
          onClick={props.onLogout}
          className="flex w-full items-center rounded-xl bg-white/10 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/15 transition"
        >
          <LogOut className="mr-3 h-4 w-4 shrink-0 text-zinc-400" />
          Deconectare
        </button>
      </div>

      {props.title ? (
        <div className="mt-2 px-3 pb-2 text-[10px] text-zinc-500 uppercase tracking-widest truncate">
          {props.title}
        </div>
      ) : null}
    </div>
  );
}

export default function AppShell(props: {
  title?: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeMobileNav = () => setMobileNavOpen(false);

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  // ESC closes mobile drawer
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileNavOpen(false);
    }
    if (mobileNavOpen) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileNavOpen]);

  // prevent body scroll when drawer open
  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  const topTitle = useMemo(() => props.title ?? "", [props.title]);

  const isImpersonationMode = useMemo(() => isImpersonating(), []);
  const currentUser = useMemo(() => getCurrentUser(), []);

  const onExitImpersonation = () => {
    logout();
    window.close(); // Try to close tab
    setTimeout(() => navigate("/login"), 100); // Fallback
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {isImpersonationMode && (
        <div className="sticky top-0 z-50 bg-blue-600 text-white px-4 py-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <span className="bg-white text-blue-600 px-1.5 py-0.5 rounded">MOD TEST</span>
            <span>Ești autentificat ca: <strong>{currentUser?.displayName || currentUser?.username}</strong></span>
          </div>
          <button
            onClick={onExitImpersonation}
            className="hover:bg-white/20 px-3 py-1 rounded-lg transition border border-white/20"
          >
            Ieși din Mod Test
          </button>
        </div>
      )}

      {/* Top bar */}
      <header className={cx("sticky z-40 border-b border-white/10 bg-zinc-950/80 backdrop-blur", isImpersonationMode ? "top-[40px]" : "top-0")}>
        <div className="flex h-14 w-full items-center gap-3 px-4">
          {/* Mobile menu button */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-200 hover:bg-white/10 lg:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Deschide navigatia"
          >
            <IconHamburger className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-teal-500/20 ring-1 ring-teal-400/40" />
            <span className="font-semibold tracking-tight">CMMS</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {topTitle ? (
              <span className="hidden sm:block text-sm text-zinc-400">
                {topTitle}
              </span>
            ) : null}
            <div className="h-8 w-8 rounded-full bg-white/10 ring-1 ring-white/10" />
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={closeMobileNav}
          />
          <div className="absolute left-0 top-0 h-full w-[300px] max-w-[85vw] p-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-zinc-200">Meniu</div>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-200 hover:bg-white/10"
                onClick={closeMobileNav}
                aria-label="Inchide navigatia"
              >
                <IconX className="h-5 w-5" />
              </button>
            </div>

            <Sidebar
              title={props.title}
              onNavigate={closeMobileNav}
              onLogout={onLogout}
            />
          </div>
        </div>
      ) : null}

      {/* Body */}
      <div className="mx-auto w-full px-4 py-6">
        <div className="grid w-full gap-6 lg:grid-cols-[280px_1fr]">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block">
            <Sidebar title={props.title} onLogout={onLogout} />
          </aside>

          {/* Content */}
          <main className="min-w-0">
            <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
              {props.title ? (
                <div className="mb-4 flex flex-wrap items-center gap-4">
                  <h1 className="text-xl font-semibold tracking-tight">
                    {props.title}
                  </h1>
                  {props.headerActions && (
                    <div className="flex items-center gap-2">
                      {props.headerActions}
                    </div>
                  )}
                </div>
              ) : null}

              {props.children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
