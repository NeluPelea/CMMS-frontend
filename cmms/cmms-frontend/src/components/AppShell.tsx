// src/components/AppShell.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { logout } from "../api";

type NavItem = { to: string; label: string };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/work-orders", label: "Work Orders" },
  { to: "/assets", label: "Assets" },
  { to: "/locations", label: "Locations" },
  { to: "/pm-plans", label: "PM Plans" },
  { to: "/parts", label: "Parts" },
  { to: "/inventory", label: "Inventory" },

  { to: "/people", label: "People" },
  { to: "/roles", label: "Roles" },
  { to: "/calendar", label: "Calendar" },
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

  return (
    <div className="h-full rounded-2xl border border-white/10 bg-white/5 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Navigation
      </div>

      <nav className="space-y-1 p-1">
        {NAV.map((it) => {
          const active =
            loc.pathname === it.to || loc.pathname.startsWith(it.to + "/");
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
              {it.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-3 border-t border-white/10 p-2">
        <button
          onClick={props.onLogout}
          className="w-full rounded-xl bg-white/10 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/15"
        >
          Logout
        </button>
      </div>

      {props.title ? (
        <div className="mt-2 px-3 pb-2 text-xs text-zinc-500">
          Page: {props.title}
        </div>
      ) : null}
    </div>
  );
}

export default function AppShell(props: {
  title?: string;
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/80 backdrop-blur">
        <div className="flex h-14 w-full items-center gap-3 px-4">
          {/* Mobile menu button */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-200 hover:bg-white/10 lg:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
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
              <div className="text-sm font-semibold text-zinc-200">Menu</div>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-200 hover:bg-white/10"
                onClick={closeMobileNav}
                aria-label="Close navigation"
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
                <h1 className="mb-4 text-xl font-semibold tracking-tight">
                  {props.title}
                </h1>
              ) : null}

              {props.children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
