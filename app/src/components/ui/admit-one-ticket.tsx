"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ADMIT ONE — the Planzo event ticket.
 *
 * Rebuilt from the paper-shaders version. The original renders its texture
 * through a WebGL2 dithering shader; that is ~1,400 lines of shader runtime
 * for a background, it forces a second GL context per ticket, and on the
 * phones this has to run on it is the difference between a ticket that opens
 * instantly and one that stutters. The look is reproduced with a layered CSS
 * gradient plus an SVG turbulence grain, which costs nothing and degrades
 * predictably.
 *
 * Two things the stock component does not do, both of which the ticket needs:
 *   - real tilt on a phone, driven by the gyroscope (iOS requires an explicit
 *     permission gesture, so there is a tap-to-enable path)
 *   - a colour identity derived from the ticket id, so every ticket is
 *     visibly its own and a screenshot of someone else's is obvious
 */

const REF = 741;

export const TICKET_GEOMETRY = {
  aspect: 741 / 425,
  cornerRadius: 25 / REF,
  notchRadius: 21 / REF,
  perforation: 562 / REF,
};

export type TicketPalette = {
  base: string; mid: string; light: string; ink: string; watermark: string;
};

/** Six hand-checked palettes. Deliberately not random — every one is legible. */
export const TICKET_PALETTES: Record<string, TicketPalette> = {
  sunset:  { base: "#EF671C", mid: "#FE9046", light: "#FFC691", ink: "#5A3520", watermark: "#FFDCBE" },
  violet:  { base: "#5B21B6", mid: "#8B5CF6", light: "#C4B5FD", ink: "#2A1065", watermark: "#EDE9FE" },
  ocean:   { base: "#0369A1", mid: "#0EA5E9", light: "#7DD3FC", ink: "#082F49", watermark: "#E0F2FE" },
  forest:  { base: "#166534", mid: "#22C55E", light: "#86EFAC", ink: "#052E16", watermark: "#DCFCE7" },
  rose:    { base: "#9F1239", mid: "#F43F5E", light: "#FDA4AF", ink: "#4C0519", watermark: "#FFE4E6" },
  midnight:{ base: "#1E1B4B", mid: "#4338CA", light: "#A5B4FC", ink: "#0F0D26", watermark: "#E0E7FF" },
};
export const PALETTE_NAMES = Object.keys(TICKET_PALETTES);

export function ticketClipPath(width: number, height: number, g = TICKET_GEOMETRY) {
  const r = g.cornerRadius * width;
  const n = g.notchRadius * width;
  const p = g.perforation * width;
  return [
    `M ${r} 0`, `L ${p - n} 0`, `A ${n} ${n} 0 0 0 ${p + n} 0`, `L ${width - r} 0`,
    `A ${r} ${r} 0 0 0 ${width} ${r}`, `L ${width} ${height - r}`,
    `A ${r} ${r} 0 0 0 ${width - r} ${height}`, `L ${p + n} ${height}`,
    `A ${n} ${n} 0 0 0 ${p - n} ${height}`, `L ${r} ${height}`,
    `A ${r} ${r} 0 0 0 0 ${height - r}`, `L 0 ${r}`, `A ${r} ${r} 0 0 0 ${r} 0`, "Z",
  ].join(" ");
}

function splitName(name: string, max = 3) {
  const clean = name.trim().replace(/\s+/g, " ").toUpperCase();
  if (!clean) return [];
  const lines: string[] = [];
  for (const word of clean.split(" ")) {
    if (lines.length < max) lines.push(word);
    else lines[lines.length - 1] = `${lines[lines.length - 1]} ${word}`;
  }
  return lines;
}

function fitScale(lines: string[], o: { availableWidth: number; availableHeight: number; fontSize: number; lineHeight: number; tracking: number; }) {
  if (!lines.length || o.fontSize <= 0 || o.availableWidth <= 0) return 1;
  const longest = Math.max(...lines.map(l => l.length));
  const charWidth = (0.6 + o.tracking) * o.fontSize;
  const block = lines.length * o.lineHeight;
  return Math.max(0.05, Math.min(1,
    charWidth > 0 ? o.availableWidth / (longest * charWidth) : 1,
    block > 0 && o.availableHeight > 0 ? o.availableHeight / block : 1));
}

function usePrefersReducedMotion() {
  return React.useSyncExternalStore(
    (cb) => { const mq = matchMedia("(prefers-reduced-motion: reduce)"); mq.addEventListener("change", cb); return () => mq.removeEventListener("change", cb); },
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/**
 * Tilt from pointer on desktop, gyroscope on a phone.
 * iOS 13+ gates DeviceOrientation behind a user gesture, so `enableGyro`
 * is exposed for a button rather than requested on mount (which silently
 * fails and looks like the feature is broken).
 */
export function useTilt(maxTilt = 10) {
  const [tilt, setTilt] = React.useState({ x: 0, y: 0 });
  const [gyroOn, setGyroOn] = React.useState(false);
  const reduced = usePrefersReducedMotion();
  const base = React.useRef<{ beta: number; gamma: number } | null>(null);

  const enableGyro = React.useCallback(async () => {
    const AnyDO = (window as any).DeviceOrientationEvent;
    if (!AnyDO) return false;
    if (typeof AnyDO.requestPermission === "function") {
      try { if ((await AnyDO.requestPermission()) !== "granted") return false; }
      catch { return false; }
    }
    setGyroOn(true);
    return true;
  }, []);

  React.useEffect(() => {
    if (!gyroOn || reduced) return;
    const onOrient = (e: DeviceOrientationEvent) => {
      const beta = e.beta ?? 0, gamma = e.gamma ?? 0;
      // Calibrate to however the phone is being held, not to flat-on-a-table.
      if (!base.current) base.current = { beta, gamma };
      const dy = Math.max(-1, Math.min(1, (beta - base.current.beta) / 34));
      const dx = Math.max(-1, Math.min(1, (gamma - base.current.gamma) / 34));
      setTilt({ x: dx * maxTilt, y: -dy * maxTilt });
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, [gyroOn, reduced, maxTilt]);

  const onPointerMove = React.useCallback((e: React.PointerEvent) => {
    if (gyroOn || reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5;
    const dy = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: dx * 2 * maxTilt, y: -(dy * 2) * maxTilt });
  }, [gyroOn, reduced, maxTilt]);

  const reset = React.useCallback(() => { if (!gyroOn) setTilt({ x: 0, y: 0 }); }, [gyroOn]);
  const gyroAvailable = typeof window !== "undefined" && "DeviceOrientationEvent" in window;

  return { tilt, onPointerMove, reset, enableGyro, gyroOn, gyroAvailable, reduced };
}

export type AdmitOneTicketProps = {
  name: string;
  presenter: string;
  event: string;
  venue: string;
  dates: string;
  stubText?: string;
  watermark?: string;
  width?: number;
  palette?: TicketPalette;
  admitted?: boolean;
  seed?: string;
  className?: string;
  tilt?: boolean;
};

export function AdmitOneTicket({
  name, presenter, event, venue, dates,
  stubText = "Admit one", watermark = "PZ", width = REF,
  palette, admitted, seed = "", className, tilt: tiltEnabled = true,
}: AdmitOneTicketProps) {
  const g = TICKET_GEOMETRY;
  const height = width / g.aspect;
  const perfX = g.perforation * width;

  // Palette follows the ticket id unless one is chosen explicitly.
  const p = React.useMemo(() => {
    if (palette) return palette;
    let h = 0;
    for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return TICKET_PALETTES[PALETTE_NAMES[h % PALETTE_NAMES.length]];
  }, [palette, seed]);

  const { tilt, onPointerMove, reset, reduced } = useTilt(tiltEnabled ? 10 : 0);

  const lines = splitName(name);
  const scale = fitScale(lines, {
    availableWidth: perfX - 0.077 * width - 0.03 * width,
    availableHeight: (348 / REF) * width - (185 / REF) * width - 0.02 * width,
    fontSize: (64.79 / REF) * width,
    lineHeight: (65 / REF) * width,
    tracking: -0.01,
  });

  const clip = `path('${ticketClipPath(width, height, g)}')`;
  const L = { pad: 0.077 * width, label: 0.0783 * width, labelSize: 0.0266 * width };

  return (
    <div
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
      className={cn("relative select-none touch-none", className)}
      style={{
        width, height,
        transform: `perspective(1100px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
        transformStyle: "preserve-3d",
        transition: reduced ? "none" : "transform 260ms cubic-bezier(0.22,1,0.36,1)",
        willChange: "transform",
      }}
    >
      <div className="relative h-full w-full" style={{ clipPath: clip }}>
        {/* Base: layered radial gradients standing in for the shader field. */}
        <div className="absolute inset-0" style={{
          background:
            `radial-gradient(58% 74% at 62% 30%, ${p.light} 0%, ${p.mid} 45%, ${p.base} 100%),` +
            `linear-gradient(135deg, ${p.base}, ${p.mid})`,
        }} />
        {/* Grain — the thing that sells it as printed stock rather than CSS. */}
        <div className="absolute inset-0 mix-blend-overlay" style={{
          opacity: 0.34,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='t'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23t)'/%3E%3C/svg%3E\")",
        }} />
        {/* Specular sweep that tracks the tilt. */}
        <div className="pointer-events-none absolute inset-0" style={{
          background: `radial-gradient(40% 60% at ${50 + tilt.x * 3}% ${50 - tilt.y * 3}%, rgba(255,255,255,.30) 0%, rgba(255,255,255,0) 70%)`,
          transition: reduced ? "none" : "background 260ms ease-out",
        }} />

        {/* Perforation */}
        <div className="absolute top-0 bottom-0" style={{
          left: perfX, width: Math.max(1, 0.0022 * width),
          backgroundImage: `repeating-linear-gradient(to bottom, ${p.ink}55 0 ${0.012 * width}px, transparent ${0.012 * width}px ${0.024 * width}px)`,
        }} />

        {/* Stub watermark. Sits BEHIND the stub text in the same narrow box, so
            it has to read as a printed tint rather than as a second label —
            at full weight the two collide into an unreadable overlap. */}
        <div className="pointer-events-none absolute grid place-items-center font-black tabular-nums"
          style={{ left: perfX, top: 0, width: width - perfX, height, color: p.watermark, opacity: 0.17 }}>
          <span style={{ writingMode: "vertical-rl", fontSize: 0.30 * width, lineHeight: 1, letterSpacing: "-0.06em" }}>
            {watermark}
          </span>
        </div>

        <div className="absolute inset-0" style={{ color: p.ink }}>
          <div className="absolute whitespace-pre uppercase"
            style={{ left: L.pad, top: L.label, fontSize: L.labelSize, lineHeight: `${0.0378 * width}px`, letterSpacing: "0.016em", fontWeight: 600 }}>
            {presenter}{"\n"}{event}
          </div>
          <div className="absolute font-semibold"
            style={{ left: L.pad, top: 0.2497 * width, fontSize: 0.0874 * width * scale, lineHeight: `${0.0877 * width * scale}px`, letterSpacing: "-0.01em" }}>
            {lines.map((line, i) => <div key={i}>{line}</div>)}
          </div>
          <div className="absolute whitespace-nowrap uppercase"
            style={{ left: L.pad, top: 0.4696 * width, fontSize: L.labelSize, letterSpacing: "0.016em", fontWeight: 600 }}>
            {venue} · {dates}
          </div>
          <div className="absolute grid place-items-center font-bold whitespace-nowrap uppercase"
            style={{ left: perfX, top: 0, width: width - perfX, height,
                     fontSize: 0.078 * width, letterSpacing: ".06em", opacity: 0.92 }}>
            <span style={{ writingMode: "vertical-rl" }}>{admitted ? "Admitted" : stubText}</span>
          </div>
        </div>

        {admitted && (
          <div className="absolute inset-0 grid place-items-center" style={{ background: "rgba(6,20,12,.52)" }}>
            <div className="rotate-[-14deg] rounded-xl border-[3px] px-5 py-2 text-center font-extrabold uppercase"
              style={{ borderColor: "#86EFAC", color: "#86EFAC", fontSize: 0.052 * width, letterSpacing: ".14em" }}>
              Checked in
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdmitOneTicket;
