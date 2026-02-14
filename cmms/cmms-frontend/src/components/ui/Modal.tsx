import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { IconButton, cx } from "./ui";

interface ModalProps {
    isOpen?: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxWidth?: string;
}

export function Modal({ isOpen = true, onClose, title, children, maxWidth = "max-w-md" }: ModalProps) {
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) {
            window.addEventListener("keydown", handleEsc);
            document.body.style.overflow = "hidden";
        }
        return () => {
            window.removeEventListener("keydown", handleEsc);
            document.body.style.overflow = "unset";
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Content */}
            <div
                className={cx(
                    "relative w-full bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200",
                    maxWidth
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <h2 className="text-lg font-bold text-zinc-100">{title}</h2>
                    <IconButton
                        aria-label="Close"
                        onClick={onClose}
                        variant="ghost"
                        className="text-zinc-500 hover:text-zinc-300"
                    >
                        <span className="i-lucide-x w-5 h-5" />
                    </IconButton>
                </div>

                {/* Body */}
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
