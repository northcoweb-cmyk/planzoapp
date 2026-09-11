"use client";

import * as React from "react";
import { useRef, useState, useEffect, useCallback } from "react";
import { Sparkles, Circle, Plus, ArrowUp, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Planzo prompt input.
 *
 * Adapted from the 21st.dev chat input. Four changes, each for a reason:
 *   - The model list is Free / Planzo Pro, not LLM names. Users pick a plan,
 *     not a model, and Pro is gated rather than merely selectable.
 *   - Icons are inline lucide, not five SVGs from a third-party CDN that
 *     render as broken images the moment it is unreachable.
 *   - The simulated-speech fallback is gone. The original types a hard-coded
 *     sentence about Framer Motion into the box when the mic is unavailable;
 *     that would ship to real users.
 *   - It goes full-bleed under 480px so it works as a docked mobile bar.
 */

const SPRING = "max-width .4s cubic-bezier(.175,.885,.32,1.275), height .4s cubic-bezier(.175,.885,.32,1.275)";
const SMOOTH = "max-width .4s cubic-bezier(.175,.885,.32,1.275), height .15s ease-out";

export type Tier = "Free" | "Planzo Pro";
export type Effort = "Quick" | "Balanced" | "Deep";

function MorphingText({ text }: { text: string }) {
  const [width, setWidth] = useState<number | "auto">("auto");
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => { if (ref.current) setWidth(ref.current.offsetWidth); }, [text]);
  return (
    <span className="relative inline-flex items-center justify-center overflow-hidden transition-all duration-300 ease-[cubic-bezier(.175,.885,.32,1.275)]" style={{ width }}>
      <span ref={ref} className="invisible whitespace-nowrap px-1">{text}</span>
      <span key={text} className="absolute inset-0 flex items-center justify-center whitespace-nowrap animate-in fade-in zoom-in-95 duration-300">{text}</span>
    </span>
  );
}

function EffortBars({ level }: { level: Effort }) {
  const mid = level !== "Quick";
  const high = level === "Deep";
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1.5" y="8" width="2.5" height="4.5" rx="1" fill="currentColor" />
      <rect x="5.75" y="5" width="2.5" height="7.5" rx="1" fill="currentColor" className="transition-opacity duration-300" opacity={mid ? 1 : 0.3} />
      <rect x="10" y="2" width="2.5" height="10.5" rx="1" fill="currentColor" className="transition-opacity duration-300" opacity={high ? 1 : 0.3} />
    </svg>
  );
}

export interface PromptInputProps {
  onSubmit?: (value: string, meta: { tier: Tier; effort: Effort }) => void;
  placeholder?: string;
  className?: string;
  tiers?: Tier[];
  efforts?: Effort[];
  proUnlocked?: boolean;
  onProRequest?: () => void;
  busy?: boolean;
}

export const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  ({ onSubmit, placeholder = "What are we doing?", className,
     tiers = ["Free", "Planzo Pro"], efforts = ["Quick", "Balanced", "Deep"],
     proUnlocked = false, onProRequest, busy }, ref) => {
    const [expanded, setExpanded] = useState(false);
    const [smooth, setSmooth] = useState(false);
    const [value, setValue] = useState("");
    const [tier, setTier] = useState<Tier>("Free");
    const [effortIdx, setEffortIdx] = useState(1);
    const [tierOpen, setTierOpen] = useState(false);
    const [recording, setRecording] = useState(false);
    const [audio, setAudio] = useState<number[]>(new Array(5).fill(0));
    const [containerH, setContainerH] = useState(112);
    const [taH, setTaH] = useState(64);
    const [scrolls, setScrolls] = useState(false);

    const taRef = useRef<HTMLTextAreaElement>(null);
    const boxRef = useRef<HTMLDivElement | null>(null);
    const topFade = useRef<HTMLDivElement>(null);
    const botFade = useRef<HTMLDivElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const ctxRef = useRef<AudioContext | null>(null);
    const rafRef = useRef<number | null>(null);
    const recRef = useRef<any>(null);

    const hasValue = value.trim() !== "";

    const updateFades = useCallback(() => {
      const el = taRef.current; if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (topFade.current) topFade.current.style.opacity = String(Math.min(scrollTop / 20, 1));
      if (botFade.current) botFade.current.style.opacity = String(Math.min(Math.max(scrollHeight - clientHeight - scrollTop - 16, 0) / 10, 1));
    }, []);

    const stopRecording = useCallback(() => {
      recRef.current?.stop?.(); recRef.current = null;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
      ctxRef.current?.close(); ctxRef.current = null;
      setRecording(false); setAudio(new Array(5).fill(0));
    }, []);

    const startRecording = useCallback(async () => {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      let stream: MediaStream | null = null;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { stream = null; }
      // No mic or no recognition means no dictation. It says so and stops —
      // it does not type a fake sentence to look like it worked.
      if (!stream || !SR) { stream?.getTracks().forEach(t => t.stop()); return false; }

      setSmooth(false); setExpanded(true); setRecording(true);
      streamRef.current = stream;

      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const actx = new Ctx(); ctxRef.current = actx;
      const analyser = actx.createAnalyser(); analyser.fftSize = 64;
      actx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const step = Math.floor(data.length / 5);
        setAudio(Array.from({ length: 5 }, (_, i) => {
          let s = 0; for (let j = 0; j < step; j++) s += data[i * step + j];
          return s / step / 255;
        }));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      const rec = new SR();
      rec.continuous = true; rec.interimResults = true;
      let baseline = value;
      rec.onresult = (e: any) => {
        let interim = "", final = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }
        if (final) baseline += (baseline ? " " : "") + final;
        setValue((baseline + (interim ? " " + interim : "")).trim());
      };
      rec.onerror = stopRecording;
      rec.onend = stopRecording;
      recRef.current = rec; rec.start();
      return true;
    }, [value, stopRecording]);

    useEffect(() => () => stopRecording(), [stopRecording]);
    useEffect(() => { if (hasValue && !expanded) { setSmooth(false); setExpanded(true); } }, [hasValue, expanded]);
    useEffect(() => {
      if (!expanded || recording) return;
      const t = setTimeout(() => { taRef.current?.focus(); const l = taRef.current?.value.length ?? 0; taRef.current?.setSelectionRange(l, l); }, 50);
      return () => clearTimeout(t);
    }, [expanded, recording]);

    useEffect(() => {
      const el = taRef.current; if (!el) return;
      const prev = el.style.height;
      el.style.transition = "none"; el.style.height = "0px";
      const sh = el.scrollHeight;
      el.style.height = prev; void el.offsetHeight; el.style.transition = "";
      const h = Math.max(64, Math.min(sh, 150));
      el.style.height = `${h}px`;
      setTaH(h); setScrolls(sh > 150);
      setTimeout(updateFades, 0);
    }, [value, expanded, updateFades]);

    useEffect(() => { setContainerH(Math.max(112, taH + 48)); }, [taH]);
    useEffect(() => {
      if (!tierOpen) return;
      const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setTierOpen(false); };
      document.addEventListener("mousedown", h);
      return () => document.removeEventListener("mousedown", h);
    }, [tierOpen]);

    const submit = () => {
      if (!hasValue || busy) return;
      setSmooth(false);
      onSubmit?.(value, { tier, effort: efforts[effortIdx] });
      setValue(""); setExpanded(false); setTierOpen(false);
    };

    const showArrow = hasValue && !recording;
    const showStop = recording;

    return (
      <div
        ref={(n) => { if (typeof ref === "function") ref(n); else if (ref) (ref as any).current = n; boxRef.current = n; }}
        onBlur={(e) => {
          if (boxRef.current?.contains(e.relatedTarget as Node)) return;
          if (!hasValue && !recording) { setSmooth(false); setExpanded(false); setTierOpen(false); }
        }}
        className={cn("relative flex w-full flex-col", className)}
        style={{ maxWidth: expanded ? 560 : 400, transition: smooth ? "max-width .15s ease-out" : "max-width .4s cubic-bezier(.175,.885,.32,1.275)" }}
      >
        <div
          onMouseDown={(e) => { if (expanded && e.target !== taRef.current && !recording) { e.preventDefault(); taRef.current?.focus(); } }}
          style={{ borderRadius: 26, height: expanded ? containerH : 52, transition: smooth ? SMOOTH : SPRING, overflow: expanded ? "visible" : "hidden" }}
          className="glass glass-2 relative z-10 w-full"
        >
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => { setSmooth(true); setValue(e.target.value); }}
            onScroll={updateFades}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
              if (e.key === "Escape" && !hasValue) { setSmooth(false); setExpanded(false); setTierOpen(false); }
            }}
            placeholder={placeholder}
            aria-label="Describe your plan"
            disabled={recording}
            enterKeyHint="send"
            className={cn(
              "no-bar absolute inset-x-0 top-0 z-[1] w-full resize-none bg-transparent py-4 pl-5 pr-14 text-[15px] leading-[22px] text-white outline-none placeholder:text-white/35",
              expanded ? "opacity-100" : "pointer-events-none opacity-0",
              scrolls ? "overflow-y-auto" : "overflow-y-hidden",
            )}
            style={{ transition: smooth ? "height .15s ease-out" : "opacity .3s ease-out, height .4s cubic-bezier(.175,.885,.32,1.275)" }}
          />

          <div ref={topFade} className="pointer-events-none absolute left-5 right-14 top-0 z-[2] h-7"
            style={{ opacity: 0, background: "linear-gradient(180deg, rgba(20,20,30,.9), transparent)" }} />
          <div ref={botFade} className="pointer-events-none absolute left-5 right-14 z-[2] h-7"
            style={{ opacity: 0, top: taH - 28, background: "linear-gradient(0deg, rgba(20,20,30,.9), transparent)" }} />

          <button
            type="button"
            onClick={() => { setSmooth(false); setExpanded(true); }}
            className={cn("absolute inset-x-0 top-0 z-[1] cursor-text py-[17px] pl-5 pr-14 text-left text-[15px] font-medium leading-[18px] text-white/40 outline-none",
              expanded ? "pointer-events-none opacity-0" : "opacity-100")}
            style={{ transition: smooth ? "none" : "all .4s cubic-bezier(.175,.885,.32,1.275)" }}
          >
            {placeholder}
          </button>

          <div className={cn("absolute bottom-2 left-3 right-14 z-10 flex items-center transition-all duration-300 ease-[cubic-bezier(.175,.885,.32,1.275)]",
            expanded && !recording ? "translate-y-0 opacity-100 blur-0" : "pointer-events-none translate-y-2 opacity-0 blur-sm")}>
            <div className="relative">
              <button type="button" onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => { e.stopPropagation(); setTierOpen(v => !v); }}
                className={cn("group flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-white/45 transition-all duration-200 hover:bg-white/10 hover:text-white",
                  tierOpen && "bg-white/10 text-white")}
                aria-label={`Plan: ${tier}`}>
                {tier === "Planzo Pro" ? <Sparkles className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                <span className="text-xs font-semibold"><MorphingText text={tier} /></span>
              </button>

              <div style={{ transformOrigin: "bottom left" }}
                className={cn("glass absolute bottom-full left-0 z-50 mb-2.5 flex w-52 flex-col gap-0.5 rounded-2xl p-1.5 transition-all duration-300",
                  tierOpen ? "pointer-events-auto translate-y-0 scale-100 opacity-100 ease-[cubic-bezier(.34,1.56,.64,1)]"
                           : "pointer-events-none translate-y-3 scale-95 opacity-0")}>
                {tiers.map((t) => {
                  const locked = t === "Planzo Pro" && !proUnlocked;
                  return (
                    <button key={t} type="button" onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (locked) { setTierOpen(false); onProRequest?.(); return; }
                        setTier(t); setTierOpen(false);
                      }}
                      className="group flex h-11 w-full items-center justify-between rounded-xl px-2.5 text-left text-[13px] font-medium text-white/80 outline-none transition-colors hover:bg-white/10 active:scale-[.98]">
                      <span className="flex items-center gap-2">
                        {t === "Planzo Pro" ? <Sparkles className="h-3.5 w-3.5 text-[#C9C1FF]" /> : <Circle className="h-3.5 w-3.5" />}
                        <span className="flex flex-col leading-tight">
                          <span>{t}</span>
                          <span className="text-[10px] text-white/35">
                            {t === "Free" ? "Groups to 8 · one day" : "Any size · multi-day trips"}
                          </span>
                        </span>
                      </span>
                      {locked && <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/50">$4.99</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <button type="button" onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.stopPropagation(); setEffortIdx(i => (i + 1) % efforts.length); }}
              className="group flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-white/45 transition-all duration-200 hover:bg-white/10 hover:text-white"
              aria-label={`Effort: ${efforts[effortIdx]}`}>
              <EffortBars level={efforts[effortIdx]} />
              <span className="text-xs font-semibold"><MorphingText text={efforts[effortIdx]} /></span>
            </button>

            <button type="button" onMouseDown={(e) => e.preventDefault()}
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition-all duration-200 hover:bg-white/10 hover:text-white">
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className={cn("absolute bottom-2 right-14 z-10 flex h-9 items-center justify-end gap-[3px] transition-all duration-300",
            recording ? "w-16 translate-x-0 opacity-100" : "pointer-events-none w-0 translate-x-4 opacity-0")}>
            {audio.map((v, i) => (
              <div key={i} className="w-1 rounded-full bg-[#7C6BFF] transition-[height] duration-75"
                style={{ height: `${Math.max(4, v * 26)}px` }} />
            ))}
          </div>

          <button type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={() => { if (recording) stopRecording(); else if (hasValue) submit(); else startRecording(); }}
            aria-label={showArrow ? "Send" : showStop ? "Stop" : "Voice input"}
            disabled={busy}
            className="absolute bottom-2 right-2 z-10 flex h-9 w-9 items-center justify-center rounded-full text-white outline-none transition-all duration-300 hover:brightness-110 active:scale-95 disabled:opacity-50"
            style={{ background: hasValue || recording ? "var(--grad-brand)" : "rgba(255,255,255,.10)" }}>
            <span className="relative flex h-full w-full items-center justify-center">
              <span className={cn("absolute inset-0 flex items-center justify-center transition-all duration-300",
                showArrow && !busy ? "rotate-0 scale-100 opacity-100" : "pointer-events-none rotate-45 scale-50 opacity-0")}>
                <ArrowUp className="h-4 w-4" strokeWidth={2.4} />
              </span>
              <span className={cn("absolute inset-0 flex items-center justify-center transition-all duration-300",
                !hasValue && !recording && !busy ? "rotate-0 scale-100 opacity-100" : "pointer-events-none -rotate-45 scale-50 opacity-0")}>
                <Mic className="h-4 w-4" />
              </span>
              <span className={cn("absolute inset-0 flex items-center justify-center transition-all duration-300",
                showStop ? "rotate-0 scale-100 opacity-100" : "pointer-events-none rotate-45 scale-50 opacity-0")}>
                <Square className="h-3.5 w-3.5 fill-current" />
              </span>
              {busy && <span className="absolute h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
            </span>
          </button>
        </div>
      </div>
    );
  },
);
PromptInput.displayName = "PromptInput";
export default PromptInput;
