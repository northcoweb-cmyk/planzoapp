"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Glass({ className, children, style, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass rounded-[var(--r-lg)]", className)} style={style} {...p}>{children}</div>;
}

export function Sheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title?: string; children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  // Portalled to <body> on purpose. A `position: fixed` element resolves
  // against the nearest ancestor with a transform, filter or backdrop-filter
  // — and the page-transition wrapper has all three while animating. Without
  // the portal the sheet lays itself out inside the screen and the content
  // behind bleeds straight through it.
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ background: "rgba(4,4,10,.62)", backdropFilter: "blur(6px)" }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, scale: .97, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className="glass glass-2 max-h-[86dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[34px] px-5 pb-[calc(24px+var(--safe-b))] pt-5 no-bar sm:rounded-[34px] sm:pb-6"
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-white/20 sm:hidden" />
        {title && <h3 className="mb-4 text-[19px]">{title}</h3>}
        {children}
      </motion.div>
    </motion.div>,
    document.body,
  );
}

export function Notice({ children, tone = "warn" }: { children: React.ReactNode; tone?: "warn" | "info" }) {
  return (
    <div className={cn("rounded-2xl border px-4 py-3 text-[13.5px] leading-relaxed",
      tone === "warn"
        ? "border-amber-400/25 bg-amber-400/10 text-amber-100/90"
        : "border-indigo-400/25 bg-indigo-400/10 text-indigo-100/90")}>
      {children}
    </div>
  );
}

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[.07] px-2.5 py-1 text-[11.5px] font-semibold text-white/75 backdrop-blur-sm", className)}>
      {children}
    </span>
  );
}

/** Progressive image: shimmer, then a soft fade-in. Never a broken icon. */
export function Img({ src, alt, className, ratio = "16/9" }: { src?: string | null; alt: string; className?: string; ratio?: string }) {
  const [state, setState] = React.useState<"load" | "ok" | "fail">(src ? "load" : "fail");
  React.useEffect(() => { setState(src ? "load" : "fail"); }, [src]);
  return (
    <div className={cn("relative overflow-hidden bg-white/[.05]", className)} style={{ aspectRatio: ratio }}>
      {state === "load" && <div className="skeleton absolute inset-0" />}
      {state === "fail" && (
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(99,102,241,.35), rgba(192,38,211,.28))" }} />
      )}
      {src && (
        <img
          src={src} alt={alt} loading="lazy" decoding="async"
          onLoad={() => setState("ok")} onError={() => setState("fail")}
          className={cn("h-full w-full object-cover transition-opacity duration-500", state === "ok" ? "opacity-100" : "opacity-0")}
        />
      )}
    </div>
  );
}
