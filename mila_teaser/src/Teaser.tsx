/* Mila teaser — 7.0 s, 1080x1920, 60 fps. Every cue comes from beats.json (generated from the song analysis):
 * the storyboard times are targets, the beat grid is law. */
import React from 'react';
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { loadFont } from '@remotion/fonts';
import beats from './beats.json';

// Google Fonts (Instrument Serif 400, Inter 300/400, latin), downloaded from fonts.google.com and served locally so the
// render never depends on the network
const serif = 'Instrument Serif', inter = 'Inter';
loadFont({ family: serif, url: staticFile('fonts/instrument-serif-400.woff2'), weight: '400' });
loadFont({ family: inter, url: staticFile('fonts/inter-300.woff2'), weight: '300' });
loadFont({ family: inter, url: staticFile('fonts/inter-400.woff2'), weight: '400' });

const NAVY = '#1A1A2E', PERI = '#8E9BFF', LAV = '#C9B6FF', SOFT = '#F7F5FF';
const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const C = beats.cues;
const CAL = beats.calendar as [string, string, number, number, number][];
const NOTES = beats.notes as [number, string][];
const SENT = beats.sent as [number, string][];
// progress helpers (always eased, never linear)
const p = (t: number, a: number, b: number, ease = EASE) => interpolate(t, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
const pin = (t: number, a: number, b: number) => p(t, a, b, Easing.bezier(0.64, 0, 0.78, 0));            // ease-in for exits
const decay = (t: number, T: number, k = 8) => (t >= T ? Math.exp(-(t - T) * k) : 0);
const lastBeat = (t: number) => { let b = -9; for (const x of beats.beats) if (x <= t) b = x; return b; };
const bassAt = (f: number) => beats.bass[Math.max(0, Math.min(beats.bass.length - 1, f))];

// text that resolves out of blur while its letter-spacing tightens
const Resolve: React.FC<{ t: number; at: number; dur?: number; out?: number; style: React.CSSProperties; children: React.ReactNode }> = ({ t, at, dur = 0.5, out, style, children }) => {
  const k = p(t, at - dur, at), o = out !== undefined ? pin(t, out, out + 0.12) : 0;
  return <div style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', whiteSpace: 'nowrap', ...style,
    opacity: k * (1 - o), filter: `blur(${(1 - k) * 22 + o * 16}px)`, letterSpacing: `${0.09 * (1 - k) - 0.012}em`,
    transform: `translateY(${(1 - k) * 18}px) scale(${1 - o * 0.06})` }}>{children}</div>;
};

const Glass: React.FC<{ style: React.CSSProperties; children?: React.ReactNode; radius?: number }> = ({ style, children, radius = 28 }) => (
  <div style={{ position: 'absolute', borderRadius: radius, background: 'linear-gradient(180deg, rgba(247,245,255,.10), rgba(247,245,255,.035))',
    border: '1px solid rgba(247,245,255,.15)', backdropFilter: 'blur(22px) saturate(140%)', WebkitBackdropFilter: 'blur(22px) saturate(140%)',
    boxShadow: 'inset 0 1px 0 rgba(247,245,255,.12), inset 0 0 24px rgba(201,182,255,.06), 0 30px 60px -24px rgba(5,5,15,.7)', color: SOFT, ...style }}>{children}</div>
);

const Stage: React.FC<{ layer: 'bg' | 'fg' }> = ({ layer }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const t = frame / fps;
  const bass = bassAt(frame), beatBob = (k = 4) => -k * decay(t, lastBeat(t), 9);
  const push = 1 + 0.04 * p(t, 0, beats.duration, Easing.bezier(0.45, 0, 0.55, 1));
  const D = C.drop;
  const bloom = p(t, D, D + 0.75), settle = p(t, D + 0.4, C.mila);
  // ---------------- background aura: dim light behind frosted glass, breathing with the bass
  const preAura = 0.30 + 0.10 * bass;
  const auraScale = 1 + 0.03 * bass;
  return (
    <AbsoluteFill style={{ backgroundColor: layer === 'bg' ? NAVY : 'transparent', transform: `scale(${push})` }}>
      {/* back light */}
      {layer === 'bg' && <AbsoluteFill style={{ opacity: Math.min(1, preAura * 1.6) * (1 - bloom), transform: `scale(${auraScale})`, filter: `brightness(${1 + 0.15 * bass})` }}>
        <Img src={staticFile('light/dark_aura.png')} style={{ width: 1080, height: 1920 }} />
      </AbsoluteFill>}
      {layer === 'fg' && <>
      {/* 1 · the light sweep + "your weekend:" */}
      {t < C.openHouses + 0.2 && (() => {
        const s = p(t, 0, C.weekend + 0.15);
        return <div style={{ position: 'absolute', top: 735, left: interpolate(s, [0, 1], [-900, 1080]), width: 900, height: 2, opacity: 1 - p(t, C.weekend, C.weekend + 0.3),
          background: `linear-gradient(90deg, transparent, ${PERI} 70%, ${SOFT})`, boxShadow: `0 0 24px 4px ${PERI}88`, filter: 'blur(0.5px)' }} />;
      })()}
      {t < C.openHouses + 0.1 && <Resolve t={t} at={C.weekend} out={C.openHouses - 0.12} style={{ top: 690, fontFamily: serif, fontSize: 128, color: SOFT }}>your weekend:</Resolve>}
      {/* 2 · the weekend fills: phrase per beat, glass calendar cards drifting at depth */}
      {t >= C.openHouses - 0.5 && t < C.monday && (<>
        {CAL.map(([lab, sub, x, y, z], i) => {
          const a = p(t, C.openHouses - 0.4 + i * 0.12, C.openHouses + 0.3 + i * 0.12), drift = (t - C.openHouses) * (40 + z * 60), out = pin(t, C.monday - 0.18, C.monday);
          return <Glass key={i} style={{ left: x, top: y - drift + beatBob(3), width: 300 * (0.7 + z * 0.4), padding: `${18 * (0.7 + z * 0.4)}px ${22 * (0.7 + z * 0.4)}px`,
            opacity: a * (0.25 + 0.5 * z) * (1 - out), filter: `blur(${(1 - z) * 7 + (z > 0.9 ? 2 : 0)}px)`, transform: `scale(${0.7 + z * 0.4})`, zIndex: z > 0.9 ? 3 : 0 }}>
            <div style={{ fontFamily: inter, fontWeight: 300, fontSize: 20, opacity: 0.7, letterSpacing: '0.04em' }}>{sub}</div>
            <div style={{ fontFamily: serif, fontSize: 36, marginTop: 6 }}>{lab}</div></Glass>;
        })}
        <Resolve t={t} at={C.openHouses} dur={0.35} out={C.monday - 0.12} style={{ top: 640, fontFamily: serif, fontSize: 112, color: SOFT, zIndex: 2 }}>2 open houses.</Resolve>
        <Resolve t={t} at={C.showings} dur={0.35} out={C.monday - 0.12} style={{ top: 780, fontFamily: serif, fontSize: 112, color: SOFT, zIndex: 2 }}>3 showings.</Resolve>
      </>)}
      {/* 3 · "monday:" and the pile-up behind it (each card on a beat subdivision, tightening) */}
      {t >= C.monday - 0.4 && t < C.breath + 0.1 && (<>
        {NOTES.map(([at, txt], i) => {
          const a = p(t, at, at + 0.22), n = NOTES.filter(([b2]) => t >= b2).length, depth = n - 1 - i, gone = pin(t, C.breath - 0.06, C.breath);
          if (t < at) return null;
          return <Glass key={i} radius={24} style={{ left: 170, width: 740, padding: '22px 28px', top: 900 - depth * 74 - (1 - a) * 80 + beatBob(2), opacity: a * Math.max(0, 1 - depth * 0.16) * (1 - gone),
            filter: `blur(${depth * 4.5 + gone * 12}px)`, transform: `scale(${(1 - depth * 0.05) * (1 - gone * 0.15)})`, zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}><div style={{ width: 10, height: 10, borderRadius: 5, background: LAV, boxShadow: `0 0 12px ${LAV}` }} />
              <div style={{ fontFamily: inter, fontWeight: 300, fontSize: 34, letterSpacing: '0.01em' }}>{txt}</div></div></Glass>;
        })}
        <Resolve t={t} at={C.monday} dur={0.4} style={{ top: 560, fontFamily: serif, fontSize: 132, color: SOFT, zIndex: 4, opacity: 1 }}>
          <span style={{ opacity: 1 - pin(t, C.breath - 0.08, C.breath) }}>monday:</span></Resolve>
      </>)}
      {/* 4 · the breath: one input bar, the ask writes in with a soft periwinkle cursor glow */}
      {t >= C.breath - 0.02 && t < D + 0.9 && (() => {
        const a = p(t, C.breath, C.breath + 0.35), full = beats.prompt, n = full.length;
        const shown = (k: number) => p(t, C.typeStart + (k / n) * (C.typeEnd - C.typeStart), C.typeStart + (k / n) * (C.typeEnd - C.typeStart) + 0.09);
        const cur = Math.min(n, (t - C.typeStart) / (C.typeEnd - C.typeStart) * n);
        const pulse = decay(t, D, 7), dis = p(t, D + 0.05, D + 0.6);
        return <Glass radius={60} style={{ left: 160, top: 900, width: 760, height: 120, display: 'flex', alignItems: 'center', padding: '0 40px', opacity: a * (1 - dis),
          transform: `translateY(${(1 - a) * 24}px) scale(${1 + 0.05 * pulse + 0.15 * dis})`, filter: `blur(${dis * 14}px)`,
          boxShadow: `0 0 ${40 + 160 * pulse}px ${10 + 40 * pulse}px rgba(142,155,255,${0.12 + 0.5 * pulse}), inset 0 1px 0 rgba(247,245,255,.12)` }}>
          <div style={{ fontFamily: inter, fontWeight: 300, fontSize: 33, color: SOFT, whiteSpace: 'nowrap', position: 'relative' }}>
            {full.split('').map((ch, k) => <span key={k} style={{ opacity: shown(k), filter: `blur(${(1 - shown(k)) * 4}px)` }}>{ch}</span>)}
            <span style={{ position: 'absolute', top: 2, left: `${(cur / n) * 100}%`, width: 3, height: 38, borderRadius: 2, background: PERI,
              boxShadow: `0 0 18px 4px ${PERI}`, opacity: t < D ? 0.65 + 0.35 * Math.sin(t * 12) : 0 }} />
          </div></Glass>;
      })()}
      </>}
      {/* 5 · THE DROP: light blooms out of the bar into a full aura; sent cards fly outward */}
      {layer === 'bg' && t >= D - 0.02 && (
        <AbsoluteFill style={{ opacity: bloom }}>
          <Img src={staticFile('light/bloom.png')} style={{ position: 'absolute', left: 540 - 1600, top: 960 - 1600, width: 3200, height: 3200,
            transform: `scale(${(0.08 + 0.92 * bloom) * (1 + 0.025 * bass * settle)})`, filter: `brightness(${1 + 0.06 * bass * settle})` }} />
        </AbsoluteFill>)}
      {layer === 'fg' && t >= D && t < D + 1.2 && SENT.map(([ang, lab], i) => {
        const f = p(t, D + i * 0.025, D + 0.9 + i * 0.025, Easing.bezier(0.22, 1, 0.36, 1)), r = 60 + f * 1100, rad = (ang * Math.PI) / 180;
        return <Glass key={i} radius={22} style={{ left: 540 + Math.cos(rad) * r - 150, top: 960 + Math.sin(rad) * r - 34, width: 300, padding: '16px 22px',
          opacity: (1 - p(t, D + 0.5, D + 1.1)) * p(t, D, D + 0.06), transform: `rotate(${ang > 90 && ang < 270 ? -6 : 6}deg) scale(${0.85 + 0.25 * f})`,
          background: 'linear-gradient(180deg, rgba(247,245,255,.38), rgba(247,245,255,.16))', color: NAVY }}>
          <div style={{ fontFamily: inter, fontWeight: 400, fontSize: 22 }}>{lab}</div></Glass>;
      })}
      {/* 6 · Mila */}
      {layer === 'fg' && t >= C.mila - 0.6 && (<>
        <Resolve t={t} at={C.mila} dur={0.55} style={{ top: 620, fontFamily: serif, fontSize: 250, color: NAVY, lineHeight: 1 }}>Mila</Resolve>
        <Resolve t={t} at={C.tagline} dur={0.4} style={{ top: 900, fontFamily: serif, fontStyle: 'normal', fontSize: 72, color: NAVY }}>say it once.</Resolve>
        <Resolve t={t} at={C.cta} dur={0.3} style={{ top: 1040, fontFamily: inter, fontWeight: 300, fontSize: 34, color: NAVY, opacity: 0.85 }}>comment MILA for your 7-day free trial</Resolve>
      </>)}
    </AbsoluteFill>
  );
};

export const Teaser: React.FC<{ withAudio: boolean }> = ({ withAudio }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY }}>
      {/* the light layers stay out of the motion-blur stack (they barely move, and averaging 8-bit samples would band them) */}
      <Stage layer="bg" />
      <CameraMotionBlur samples={6} shutterAngle={180}><Stage layer="fg" /></CameraMotionBlur>
      {/* gentle vignette + animated film grain (~2.5%) */}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(5,5,16,.55) 100%)', mixBlendMode: 'multiply' }} />
      <AbsoluteFill style={{ opacity: 0.13, mixBlendMode: 'overlay' }}>
        <Img src={staticFile(`grain/g${String(frame % 12).padStart(2, '0')}.png`)} style={{ width: 1080, height: 1920, imageRendering: 'auto' }} />
      </AbsoluteFill>
      {withAudio && <Audio src={staticFile('audio/mix.wav')} />}
    </AbsoluteFill>
  );
};
