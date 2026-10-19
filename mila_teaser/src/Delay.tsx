/* Mila — launch delay announcement. 12.0 s, 1080x1920, 60 fps, "Da Fonk" (127.1 BPM), built on its 2:46.3 drop.
 * Calm and honest before the drop (navy, hairlines, the date flips 19 → 23), confident after it (colour fields slam on
 * every beat). Every cue is a beat/hit from beats_v3.json. */
import React from 'react';
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame, interpolate, Easing } from 'remotion';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { loadFont } from '@remotion/fonts';
import B from './beats_v3.json';

const serif = 'Instrument Serif', inter = 'Inter';
loadFont({ family: serif, url: staticFile('fonts/instrument-serif-400.woff2'), weight: '400' });
loadFont({ family: serif, url: staticFile('fonts/instrument-serif-italic.woff2'), weight: '400', style: 'italic' });
loadFont({ family: inter, url: staticFile('fonts/inter-300.woff2'), weight: '300' });
loadFont({ family: inter, url: staticFile('fonts/inter-400.woff2'), weight: '400' });

const NAVY = '#1A1A2E', PERI = '#8E9BFF', LAV = '#C9B6FF', SOFT = '#F7F5FF', LINE = 'rgba(247,245,255,.16)';
const C = B.cues, BEAT = B.beat;
const FEATS = B.feats as [string, string][];
const OUT = Easing.bezier(0.22, 1, 0.36, 1), IN = Easing.bezier(0.64, 0, 0.78, 0);
const p = (t: number, a: number, b: number, e = OUT) => interpolate(t, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: e });
const decay = (t: number, T: number, k = 9) => (t >= T ? Math.exp(-(t - T) * k) : 0);
const ACC: [number, number][] = [];
for (const [ht, w] of B.hits as [number, number][]) if (w > 0.3 && (!ACC.length || ht - ACC[ACC.length - 1][0] > BEAT * 0.45)) ACC.push([ht, w]);
const accent = (t: number, k = 10) => { let v = 0; for (const [x, w] of ACC) if (x <= t) v = Math.max(v, Math.min(1, w * 1.4) * Math.exp(-(t - x) * k)); return v; };

const Wipe: React.FC<{ t: number; at: number; out?: number; dur?: number; style: React.CSSProperties; children: React.ReactNode }> = ({ t, at, out, dur = 0.32, style, children }) => {
  const k = p(t, at, at + dur), o = out !== undefined ? p(t, out, out + 0.18, IN) : 0;
  return <div style={{ position: 'absolute', overflow: 'hidden', paddingBottom: '0.14em', ...style }}>
    <div style={{ transform: `translateY(${(1 - k) * 105 - o * 105}%)`, letterSpacing: `${-0.02 + 0.03 * (1 - k)}em` }}>{children}</div></div>;
};
const Label: React.FC<{ style: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div style={{ position: 'absolute', fontFamily: inter, fontWeight: 400, fontSize: 24, letterSpacing: '0.18em', color: 'rgba(247,245,255,.6)', ...style }}>{children}</div>
);

/** one digit card of the date; flips from `from` to `to` at `at` (top half folds down, like a split-flap) */
const Flip: React.FC<{ t: number; at: number; from: string; to: string; x: number }> = ({ t, at, from, to, x }) => {
  const k = p(t, at, at + 0.28, Easing.bezier(0.5, 0, 0.2, 1)), W = 230, H = 320;
  const half = (txt: string, top: boolean, extra: React.CSSProperties = {}) => (
    <div style={{ position: 'absolute', left: 0, top: top ? 0 : H / 2, width: W, height: H / 2, overflow: 'hidden', background: '#23233d', ...extra,
      borderRadius: top ? '18px 18px 0 0' : '0 0 18px 18px' }}>
      <div style={{ position: 'absolute', left: 0, top: top ? 0 : -H / 2, width: W, height: H, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: serif, fontSize: 260, color: SOFT, lineHeight: 1 }}>{txt}</div></div>);
  const fold = k < 0.5 ? k * 2 : (k - 0.5) * 2;
  return <div style={{ position: 'absolute', left: x, top: 0, width: W, height: H, perspective: 1200 }}>
    {half(to, true)}{half(from, false)}
    {k < 0.5 && half(from, true, { transformOrigin: '50% 100%', transform: `rotateX(${-fold * 90}deg)`, filter: `brightness(${1 - fold * 0.4})` })}
    {k >= 0.5 && half(to, false, { transformOrigin: '50% 0%', transform: `rotateX(${(1 - fold) * 90}deg)`, filter: `brightness(${0.6 + fold * 0.4})` })}
    <div style={{ position: 'absolute', left: 0, top: H / 2 - 1, width: W, height: 2, background: NAVY }} /></div>;
};

const Fg: React.FC<{ t: number }> = ({ t }) => {
  const bob = -6 * decay(t, ACC.filter(([x]) => x <= t).slice(-1)[0]?.[0] ?? -9, 12), D = C.drop;
  const pre = t < D;
  const g1 = p(t, 0, BEAT * 1.4), clearAll = p(t, C.but - 0.1, C.but + 0.1, IN);
  return (
    <AbsoluteFill>
      {/* ---------------- before the drop: an honest note */}
      {pre && <>
        <div style={{ position: 'absolute', left: 80, top: 380, height: 1, width: 920 * g1, background: LINE, opacity: 1 - clearAll }} />
        <Label style={{ left: 80, top: 320, opacity: g1 * (1 - clearAll) }}>a note from the mila team</Label>
        {t < C.notThisWeek && <Wipe t={t} at={C.owe} out={C.notThisWeek - 0.2} style={{ left: 80, top: 420, fontFamily: serif, fontSize: 132, color: SOFT, lineHeight: 1.02 }}>we owe you<br />an update.</Wipe>}
        {t >= C.notThisWeek - 0.05 && t < C.sorry && <Wipe t={t} at={C.notThisWeek} out={C.sorry - 0.2} style={{ left: 80, top: 420, fontFamily: serif, fontSize: 118, color: SOFT, lineHeight: 1.02 }}>Mila is launching<br />a little later.</Wipe>}
        {/* the date: oct 19 → oct 23 */}
        {t >= C.date - 0.1 && t < C.but && (() => {
          const a = p(t, C.date, C.date + 0.3), o = clearAll;
          return <div style={{ position: 'absolute', left: 80, top: 760, width: 920, height: 420, opacity: a * (1 - o), transform: `translateY(${(1 - a) * 40 + bob}px)` }}>
            <Label style={{ left: 0, top: -50 }}>new launch date</Label>
            <div style={{ position: 'absolute', left: 0, top: 30, fontFamily: inter, fontWeight: 300, fontSize: 64, color: SOFT, letterSpacing: '0.12em' }}>oct</div>
            <div style={{ position: 'absolute', left: 200, top: 0 }}>
              <Flip t={t} at={C.flip} from="1" to="2" x={0} /><Flip t={t} at={C.flip + 0.06} from="9" to="3" x={250} /></div>
            <div style={{ position: 'absolute', left: 190, top: 158, height: 4, background: PERI, width: 510 * p(t, C.date + 0.25, C.flip - 0.02) * (1 - p(t, C.flip, C.flip + 0.12)) }} />
          </div>;
        })()}
        {t >= C.sorry - 0.05 && t < C.but && <Wipe t={t} at={C.sorry} out={C.but - 0.15} style={{ left: 80, top: 420, fontFamily: serif, fontStyle: 'italic', fontSize: 132, color: SOFT, lineHeight: 1.02 }}>sorry for<br />the wait.</Wipe>}
        {t >= C.but - 0.05 && <Wipe t={t} at={C.but} style={{ left: 0, right: 0, top: 860, textAlign: 'center', fontFamily: serif, fontSize: 110, color: SOFT, lineHeight: 1 }}>but here’s the thing…</Wipe>}
      </>}
      {/* ---------------- the drop: three hard statements, one per beat, each on its own colour field */}
      {t >= D && t < C.feats[0] && (() => {
        const lines = [[D, 'she’s going to be'], [C.drop2, 'way better'], [C.drop3, 'than you think.']] as [number, string][];
        return lines.map(([at, txt], i) => t >= at - 0.02 && (i === 2 || t < lines[i + 1][0]) && (
          <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: 900 - (i === 1 ? 40 : 0), textAlign: 'center', fontFamily: serif, fontStyle: i === 1 ? 'italic' : 'normal',
            fontSize: i === 1 ? 250 : 140, lineHeight: 1, color: i === 1 ? SOFT : NAVY, transform: `scale(${1.18 - 0.18 * p(t, at, at + 0.22)})`, opacity: p(t, at - 0.02, at + 0.05) }}>{txt}</div>));
      })()}
      {/* ---------------- what she does: one per beat */}
      {t >= C.feats[0] - 0.02 && t < C.mila && FEATS.map(([a, b], i) => {
        const at = C.feats[i], next = i + 1 < FEATS.length ? C.feats[i + 1] : C.mila;
        if (t < at - 0.02 || t >= next) return null;
        const k = p(t, at, at + 0.22), dark = i % 2 === 1;
        return <div key={i} style={{ position: 'absolute', left: 80, top: 760 }}>
          <div style={{ overflow: 'hidden' }}><div style={{ fontFamily: serif, fontSize: 150, lineHeight: 1.04, color: dark ? SOFT : NAVY, transform: `translateY(${(1 - k) * 100}%)` }}>{a}</div></div>
          <div style={{ overflow: 'hidden' }}><div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 150, lineHeight: 1.04, color: dark ? LAV : '#4b3fc4', transform: `translateY(${(1 - p(t, at + 0.06, at + 0.28)) * 100}%)` }}>{b}</div></div>
        </div>;
      })}
      {/* ---------------- the lockup */}
      {t >= C.mila - 0.02 && (<>
        <Wipe t={t} at={C.mila} dur={0.4} style={{ left: 0, right: 0, top: 520, textAlign: 'center', fontFamily: serif, fontSize: 280, color: NAVY, lineHeight: 1 }}>Mila</Wipe>
        <Wipe t={t} at={C.mila + 0.12} style={{ left: 0, right: 0, top: 830, textAlign: 'center', fontFamily: inter, fontWeight: 300, fontSize: 64, letterSpacing: '0.3em', color: NAVY }}>10.23</Wipe>
        <div style={{ position: 'absolute', left: 540 - 200 * p(t, C.tagline - 0.1, C.tagline + 0.3), top: 950, height: 2, width: 400 * p(t, C.tagline - 0.1, C.tagline + 0.3), background: NAVY, opacity: 0.35 }} />
        <Wipe t={t} at={C.tagline} style={{ left: 0, right: 0, top: 985, textAlign: 'center', fontFamily: serif, fontStyle: 'italic', fontSize: 92, color: NAVY, lineHeight: 1 }}>worth the wait.</Wipe>
        <Wipe t={t} at={C.cta} dur={0.25} style={{ left: 0, right: 0, top: 1140, textAlign: 'center', fontFamily: inter, fontWeight: 300, fontSize: 34, color: NAVY }}>comment MILA to be first in line</Wipe>
      </>)}
    </AbsoluteFill>
  );
};

const Bg: React.FC<{ t: number }> = ({ t }) => {
  const D = C.drop;
  // after the drop the field changes colour on every beat: lavender / periwinkle (statements), then soft/navy for the features
  let field = NAVY;
  if (t >= D) field = LAV;
  if (t >= C.drop2) field = PERI;
  if (t >= C.drop3) field = LAV;
  C.feats.forEach((at: number, i: number) => { if (t >= at) field = i % 2 ? NAVY : SOFT; });
  if (t >= C.mila) field = LAV;
  const r = p(t, D, D + 0.42) * 2300;                     // the drop: a crisp disc takes the frame from the centre
  return (
    <AbsoluteFill style={{ backgroundColor: t >= D + 0.42 ? field : NAVY }}>
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${field === NAVY ? 'rgba(247,245,255,.10)' : 'rgba(26,26,46,.10)'} 1.2px, transparent 1.3px)`, backgroundSize: '40px 40px', opacity: 0.5 + 0.9 * accent(t, 9) }} />
      {t >= D && t < D + 0.42 && <div style={{ position: 'absolute', left: 540 - r, top: 960 - r, width: r * 2, height: r * 2, borderRadius: '50%', background: LAV }} />}
      {t >= D && [0, 1, 2].map(i => { const q = p(t, D + i * 0.06, D + 0.7 + i * 0.06), rr = 40 + q * 1500;
        return <div key={i} style={{ position: 'absolute', left: 540 - rr, top: 960 - rr, width: rr * 2, height: rr * 2, borderRadius: '50%', border: `2px solid ${i % 2 ? PERI : SOFT}`, opacity: (1 - q) * 0.9 }} />; })}
      {/* a beat bar at the bottom edge, alive on every hit */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 6 + 34 * accent(t, 12), background: `linear-gradient(90deg, ${PERI}, ${LAV})`, opacity: t < C.mila ? 0.9 : 0 }} />
      {t >= C.mila && <div style={{ position: 'absolute', left: 60, top: 300, right: 60, bottom: 420, border: `1px solid rgba(26,26,46,${0.25 * p(t, C.mila, C.mila + 0.4)})` }} />}
    </AbsoluteFill>
  );
};

export const Delay: React.FC<{ withAudio: boolean }> = ({ withAudio }) => {
  const frame = useCurrentFrame(); const t = frame / 60;
  const push = 1 + 0.04 * p(t, 0, B.duration, Easing.bezier(0.45, 0, 0.55, 1));
  const kick = 1 + 0.035 * decay(t, C.drop, 7) + 0.009 * accent(t, 14) + 0.02 * [C.drop2, C.drop3, ...C.feats].reduce((m: number, x: number) => Math.max(m, decay(t, x, 10)), 0);
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY }}>
      <AbsoluteFill style={{ transform: `scale(${push * kick})` }}>
        <Bg t={t} />
        <CameraMotionBlur samples={6} shutterAngle={180}><FgFrame /></CameraMotionBlur>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(5,5,16,.32) 100%)', mixBlendMode: 'multiply' }} />
      <AbsoluteFill style={{ opacity: 0.08, mixBlendMode: 'overlay' }}>
        <Img src={staticFile(`grain/g${String(frame % 12).padStart(2, '0')}.png`)} style={{ width: 1080, height: 1920 }} />
      </AbsoluteFill>
      {withAudio && <Audio src={staticFile('audio/mix_v3.wav')} />}
    </AbsoluteFill>
  );
};
// the motion-blur wrapper samples sub-frames, so the foreground must read the frame itself
const FgFrame: React.FC = () => { const f = useCurrentFrame(); return <Fg t={f / 60} />; };
