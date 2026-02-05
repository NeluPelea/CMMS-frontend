// src/components/ui/ui.tsx
import React from "react";

export function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

export function PageToolbar(props: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">{props.left}</div>
      {props.right ? <div className="min-w-0">{props.right}</div> : null}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100",
        "placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-teal-400/40",
        props.className
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx(
        "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100",
        "outline-none focus:ring-2 focus:ring-teal-400/40",
        props.className
      )}
    />
  );
}

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  const v = props.variant ?? "ghost";
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold ring-1",
        v === "primary"
          ? "bg-teal-500/20 text-teal-200 ring-teal-400/30 hover:bg-teal-500/25"
          : "bg-white/10 text-zinc-200 ring-white/15 hover:bg-white/15",
        props.disabled ? "opacity-60 hover:bg-inherit" : "",
        props.className
      )}
    />
  );
}

export function Card(props: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-2xl border border-white/10 bg-white/5 p-4", props.className)}>
      {props.title ? <div className="mb-3 text-sm font-semibold text-zinc-200">{props.title}</div> : null}
      {props.children}
    </div>
  );
}

export function ErrorBox(props: { message: string }) {
  return (
    <div className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">
      {props.message}
    </div>
  );
}

export function Pill(props: { children: React.ReactNode; tone?: "teal" | "emerald" | "zinc" | "amber" | "rose" }) {
  const t = props.tone ?? "zinc";
  const cls =
    t === "teal"
      ? "bg-teal-500/15 text-teal-200 ring-teal-400/25"
      : t === "emerald"
      ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25"
      : t === "amber"
      ? "bg-amber-500/15 text-amber-200 ring-amber-400/25"
      : t === "rose"
      ? "bg-rose-500/15 text-rose-200 ring-rose-400/25"
      : "bg-zinc-500/15 text-zinc-200 ring-zinc-400/20";

  return <span className={cx("inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1", cls)}>{props.children}</span>;
}

export function TableShell(props: { children: React.ReactNode; minWidth?: number }) {
  const minW = props.minWidth ?? 900;
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/30">
      <div className="overflow-x-auto">
        <div style={{ minWidth: minW }}>
          {props.children}
        </div>
      </div>
    </div>
  );
}

export function EmptyRow(props: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={props.colSpan} className="px-4 py-6 text-center text-zinc-400">
        {props.text}
      </td>
    </tr>
  );
}
