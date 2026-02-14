/* eslint-disable react-refresh/only-export-components */
// src/components/ui/ui.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";

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

// ---------------- Inputs ----------------

// Am adaugat "label" in interfata pentru a elimina eroarea din pagina
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

export function Input({ label, ...props }: InputProps) {
    return (
        <div className="flex w-full flex-col gap-1.5">
            {label && <label className="ml-1 text-xs font-medium text-zinc-400">{label}</label>}
            <input
                {...props}
                className={cx(
                    "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100",
                    "placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-teal-400/40",
                    props.className
                )}
            />
        </div>
    );
}

// Am adaugat "label" in interfata
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
}

export function Select({ label, children, ...props }: SelectProps) {
    return (
        <div className="flex w-full flex-col gap-1.5">
            {label && <label className="ml-1 text-xs font-medium text-zinc-400">{label}</label>}
            <select
                {...props}
                className={cx(
                    "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100",
                    "outline-none focus:ring-2 focus:ring-teal-400/40",
                    props.className
                )}
            >
                {children}
            </select>
        </div>
    );
}

export function FieldLabel(props: { children: React.ReactNode }) {
    return <label className="mb-1 block text-xs font-medium text-zinc-400">{props.children}</label>;
}

// ---------------- Buttons ----------------

// Am adaugat "size" in interfata
export function Button(
    props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
        variant?: "primary" | "ghost";
        size?: "sm" | "md" | "lg";
    }
) {
    const v = props.variant ?? "ghost";
    const size = props.size ?? "md";
    const sizeCls =
        size === "sm"
            ? "px-2.5 py-1.5 text-xs"
            : size === "lg"
                ? "px-4 py-2.5 text-sm"
                : "px-3 py-2 text-sm";

    return (
        <button
            {...props}
            className={cx(
                "inline-flex items-center justify-center rounded-xl font-semibold ring-1",
                sizeCls,
                v === "primary"
                    ? "bg-teal-500/20 text-teal-200 ring-teal-400/30 hover:bg-teal-500/25"
                    : "bg-white/10 text-zinc-200 ring-white/15 hover:bg-white/15",
                props.disabled ? "opacity-60 hover:bg-inherit" : "",
                props.className
            )}
        />
    );
}

export function IconButton(
    props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
        variant?: "ghost" | "danger";
        size?: "sm" | "md";
        "aria-label": string;
    }
) {
    const v = props.variant ?? "ghost";
    const size = props.size ?? "md";
    const sizeCls = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9";
    return (
        <button
            {...props}
            className={cx(
                "inline-flex items-center justify-center rounded-xl ring-1",
                sizeCls,
                v === "danger"
                    ? "bg-rose-500/10 text-rose-200 ring-rose-400/20 hover:bg-rose-500/15"
                    : "bg-white/10 text-zinc-200 ring-white/15 hover:bg-white/15",
                props.disabled ? "opacity-60 hover:bg-inherit" : "",
                props.className
            )}
        />
    );
}

// ---------------- Layout / Cards ----------------

export function Card(props: { title?: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={cx("rounded-2xl border border-white/10 bg-white/5 p-4", props.className)}>
            {props.title ? <div className="mb-3 text-sm font-semibold text-zinc-200">{props.title}</div> : null}
            {props.children}
        </div>
    );
}

// Am adaugat "onClose" pentru compatibilitate cu ErrorBox din pagina
export function ErrorBox(props: { message: string; onClose?: () => void }) {
    return (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-200">
            <span>{props.message}</span>
            {props.onClose && (
                <button onClick={props.onClose} className="ml-2 text-rose-300 hover:text-rose-100" aria-label="Close">
                    ✕
                </button>
            )}
        </div>
    );
}

// ---------------- Pills ----------------

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

    return (
        <span className={cx("inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1", cls)}>
            {props.children}
        </span>
    );
}

export function PillButton(props: {
    children: React.ReactNode;
    active?: boolean;
    tone?: "teal" | "emerald" | "zinc" | "amber" | "rose";
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
}) {
    const active = !!props.active;
    const t = props.tone ?? "zinc";

    const baseTone =
        t === "teal"
            ? "ring-teal-400/25 text-teal-200"
            : t === "emerald"
                ? "ring-emerald-400/25 text-emerald-200"
                : t === "amber"
                    ? "ring-amber-400/25 text-amber-200"
                    : t === "rose"
                        ? "ring-rose-400/25 text-rose-200"
                        : "ring-zinc-400/20 text-zinc-200";

    const bg = active
        ? t === "teal"
            ? "bg-teal-500/25"
            : t === "emerald"
                ? "bg-emerald-500/25"
                : t === "amber"
                    ? "bg-amber-500/25"
                    : t === "rose"
                        ? "bg-rose-500/25"
                        : "bg-zinc-500/25"
        : "bg-white/5 hover:bg-white/10";

    return (
        <button
            type="button"
            onClick={props.onClick}
            disabled={props.disabled}
            className={cx(
                "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ring-1",
                baseTone,
                bg,
                props.disabled ? "opacity-60 hover:bg-inherit" : "",
                props.className
            )}
        >
            {props.children}
        </button>
    );
}

// ---------------- Tables ----------------

export function TableShell(props: { children: React.ReactNode; minWidth?: number }) {
    const minW = props.minWidth ?? 900;
    return (
        <div className="rounded-2xl border border-white/10 bg-zinc-950/30">
            <div className="overflow-x-auto">
                <div style={{ minWidth: minW }}>{props.children}</div>
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

// ---------------- Drawer ----------------

function useOnEscape(enabled: boolean, onEscape: () => void) {
    useEffect(() => {
        if (!enabled) return;
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") onEscape();
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [enabled, onEscape]);
}

function useLockBodyScroll(enabled: boolean) {
    useEffect(() => {
        if (!enabled) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [enabled]);
}

export function Drawer(props: {
    open: boolean;
    title?: string;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
    widthClassName?: string; // ex: "w-full sm:w-[520px]"
}) {
    const widthCls = props.widthClassName ?? "w-full sm:w-[520px]";
    const panelRef = useRef<HTMLDivElement | null>(null);

    useOnEscape(props.open, props.onClose);
    useLockBodyScroll(props.open);

    useEffect(() => {
        if (!props.open) return;
        // focus first focusable inside panel
        const t = setTimeout(() => {
            const root = panelRef.current;
            if (!root) return;
            const el = root.querySelector<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            el?.focus?.();
        }, 0);
        return () => clearTimeout(t);
    }, [props.open]);

    if (!props.open) return null;

    return (
        <div className="fixed inset-0 z-50">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
                onMouseDown={(e) => {
                    // click-outside close
                    if (e.target === e.currentTarget) props.onClose();
                }}
            />
            <div className={cx("absolute right-0 top-0 h-full", widthCls)}>
                <div
                    ref={panelRef}
                    className={cx(
                        "flex h-full flex-col border-l border-white/10 bg-zinc-950/90 shadow-2xl",
                        "backdrop-blur supports-[backdrop-filter]:bg-zinc-950/70"
                    )}
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
                        <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-zinc-100">{props.title ?? "Panel"}</div>
                        </div>
                        <IconButton aria-label="Close drawer" onClick={props.onClose}>
                            ✕
                        </IconButton>
                    </div>

                    <div className="flex-1 overflow-auto p-4">{props.children}</div>

                    {props.footer ? <div className="border-t border-white/10 p-4">{props.footer}</div> : null}
                </div>
            </div>
        </div>
    );
}

// ---------------- Modal ----------------

export function Modal(props: {
    title?: string;
    children: React.ReactNode;
    onClose: () => void;
    open?: boolean;
    widthClassName?: string;
}) {
    const isOpen = props.open ?? true;
    useOnEscape(isOpen, props.onClose);
    useLockBodyScroll(isOpen);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onMouseDown={(e) => {
                    if (e.target === e.currentTarget) props.onClose();
                }}
            />
            <div
                className={cx(
                    "relative flex max-h-full w-full flex-col rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl",
                    props.widthClassName ?? "max-w-lg"
                )}
                role="dialog"
                aria-modal="true"
            >
                <div className="flex items-center justify-between border-b border-white/10 p-4">
                    <h3 className="text-lg font-semibold text-zinc-100">{props.title ?? "Modal"}</h3>
                    <IconButton aria-label="Close" onClick={props.onClose}>
                        ✕
                    </IconButton>
                </div>
                <div className="flex-1 overflow-auto p-4">{props.children}</div>
            </div>
        </div>
    );
}

// ---------------- Tabs ----------------

export type TabItem = { key: string; label: string; disabled?: boolean };

export function Tabs(props: {
    items: TabItem[];
    value?: string; // controlled
    defaultValue?: string; // uncontrolled
    onChange?: (key: string) => void;
    className?: string;
    headerClassName?: string;
    panelClassName?: string;
    render: (activeKey: string) => React.ReactNode;
}) {
    const first = useMemo(() => props.items.find((x) => !x.disabled)?.key ?? "", [props.items]);
    const [internal, setInternal] = useState<string>(props.defaultValue ?? first);

    const activeKey = props.value ?? internal;

    function setActive(k: string) {
        if (props.items.find((x) => x.key === k)?.disabled) return;
        if (props.value === undefined) setInternal(k);
        props.onChange?.(k);
    }

    return (
        <div className={cx("w-full", props.className)}>
            <div className={cx("mb-3 flex flex-wrap gap-2", props.headerClassName)}>
                {props.items.map((it) => (
                    <PillButton
                        key={it.key}
                        active={it.key === activeKey}
                        disabled={it.disabled}
                        tone={it.key === activeKey ? "teal" : "zinc"}
                        onClick={() => setActive(it.key)}
                    >
                        {it.label}
                    </PillButton>
                ))}
            </div>

            <div className={cx("min-h-[120px]", props.panelClassName)}>{props.render(activeKey)}</div>
        </div>
    );
}
