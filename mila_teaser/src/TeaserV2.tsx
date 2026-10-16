/* Mila teaser v2 — 7.0 s, 1080x1920, 60 fps, "AD LA – Nicole Kidman" at 141.1 BPM.
 * Graphic-design-first: a crisp navy canvas, hairline grid, solid colour blocks, hard mask wipes on the beat.
 * No soft blobs, no blur-in type. Every cue is a beat from beats_v2.json. */
import React from 'react';
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { loadFont } from '@remotion/fonts';
import B from './beats_v2.json';

const serif = 'Instrument Serif', inter = 'Inter';
loadFont({ family: serif, url: staticFile('fonts/instrument-serif-400.woff2'), weight: '400' });
loadFont({ family: serif, url: staticFile('fonts/instrument-serif-italic.woff2'), weight: '400', style: 'italic' });
loadFont({ family: inter, url: staticFile('fonts/inter-300.woff2'), weight: '300' });
loadFont({ family: inter, url: staticFile('fonts/inter-400.woff2'), weight: '400' });

const NAVY = '#1A1A2E', PERI = '#8E9BFF', LAV = '#C9B6FF', SOFT = '#F7F5FF', LINE = 'rgba(247,245,255,.16)';
const C = B.cues, BEAT = B.beat;
const EVENTS = B.events as [number, string, number, number, string, string, string][];
const NOTES = B.notes as [number, string, string][];
const SENT = B.sent as [string, string][];
const REPLIES = B.replies as [string, string][];
const OUT = Easing.bezier(0.22, 1, 0.36, 1), IN = Easing.bezier(0.64, 0, 0.78, 0);
const p = (t: number, a: number, b: number, e = OUT) => interpolate(t, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: e });
const decay = (t: number, T: number, k = 9) => (t >= T ? Math.exp(-(t - T) * k) : 0);
// accents = the real kick/clap hits you can hear (strong ones, at most one per half beat): everything pulses on THESE
const ACC: [number, number][] = [];
for (const [ht, w] of B.hits as [number, number][]) if (w > 0.3 && (!ACC.length || ht - ACC[ACC.length - 1][0] > BEAT * 0.45)) ACC.push([ht, w]);
const lastBeat = (t: number) => { let b = -9; for (const [x] of ACC) if (x <= t) b = x; return b; };
const accent = (t: number, k = 10) => { let v = 0; for (const [x, w] of ACC) if (x <= t) v = Math.max(v, Math.min(1, w * 1.4) * Math.exp(-(t - x) * k)); return v; };

/** a line of type revealed by a hard mask wipe (rises out of its own baseline), exits the same way */
const Wipe: React.FC<{ t: number; at: number; out?: number; dur?: number; style: React.CSSProperties; children: React.ReactNode }> = ({ t, at, out, dur = 0.32, style, children }) => {
  const k = p(t, at, at + dur), o = out !== undefined ? p(t, out, out + 0.2, IN) : 0;
  return <div style={{ position: 'absolute', overflow: 'hidden', paddingBottom: '0.12em', ...style }}>
    <div style={{ transform: `translateY(${(1 - k) * 105 - o * 105}%)`, letterSpacing: `${-0.02 + 0.03 * (1 - k)}em` }}>{children}</div></div>;
};
const Label: React.FC<{ style: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div style={{ position: 'absolute', fontFamily: inter, fontWeight: 400, fontSize: 22, letterSpacing: '0.16em', color: 'rgba(247,245,255,.55)', ...style }}>{children}</div>
);

const Fg: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const t = frame / fps;
  const bob = -6 * decay(t, lastBeat(t), 12);
  const D = C.drop, gone = t >= C.breath;                        // the breath clears the stage
  // ---------------- 1 · the hairline grid draws itself on the first beats
  const g1 = p(t, 0, BEAT * 1.2), clr = p(t, C.monday - 0.1, C.monday + 0.15, IN);
  const rules = [380, 1500].map((y, i) => <div key={i} style={{ position: 'absolute', left: 80, top: y, height: 1, width: 920 * g1, background: LINE, opacity: 1 - clr }} />);
  // ---------------- calendar (weekend) geometry
  const CX = 80, CY = 660, CW = 830, ROW = 74, H0 = 9, COLW = (CW - 90) / 2;
  const calIn = p(t, C.openHouses - 0.12, C.openHouses + 0.3), calOut = p(t, C.monday - 0.12, C.monday + 0.1, IN);
  return (
    <AbsoluteFill>
      {!gone && rules}
      {!gone && <Label style={{ left: 80, top: 330, opacity: g1 * (1 - clr) }}>{t < C.monday ? 'sat 14 — sun 15' : ''}</Label>}
      {/* "your weekend:" */}
      {t < C.monday && <Wipe t={t} at={C.weekend} out={C.openHouses - 0.2} style={{ left: 80, top: 400, fontFamily: serif, fontSize: 150, color: SOFT, lineHeight: 1 }}>your weekend:</Wipe>}
      {/* the weekend fills up */}
      {t >= C.openHouses - 0.2 && t < C.monday + 0.15 && (<>
        <Wipe t={t} at={C.openHouses + 0.02} out={C.monday - 0.12} style={{ left: 80, top: 400, fontFamily: serif, fontSize: 120, color: SOFT, lineHeight: 1 }}>2 open houses.</Wipe>
        <Wipe t={t} at={C.showings} out={C.monday - 0.12} style={{ left: 80, top: 520, fontFamily: serif, fontSize: 120, color: SOFT, lineHeight: 1 }}>3 showings.</Wipe>
        <div style={{ position: 'absolute', left: CX, top: CY + 60, width: CW, height: 10 * ROW + 60, opacity: calIn * (1 - calOut), transform: `translateY(${(1 - calIn) * 40 + bob}px)` }}>
          {['sat', 'sun'].map((d, i) => <Label key={d} style={{ left: 90 + i * COLW + 6, top: 0, color: SOFT }}>{d} <span style={{ fontFamily: serif, fontSize: 40, letterSpacing: 0 }}>{14 + i}</span></Label>)}
          {Array.from({ length: 10 }, (_, i) => <div key={i} style={{ position: 'absolute', left: 0, top: 60 + i * ROW, width: CW * p(t, C.openHouses - 0.1 + i * 0.02, C.openHouses + 0.25 + i * 0.02), height: 1, background: LINE }}>
            <span style={{ position: 'absolute', top: 8, fontFamily: inter, fontWeight: 300, fontSize: 18, color: 'rgba(247,245,255,.4)' }}>{((i + H0 - 1) % 12) + 1} {i + H0 < 12 ? 'am' : 'pm'}</span></div>)}
          {EVENTS.map(([at, d, st, du, lab, tm, col], i) => {
            const k = p(t, at, at + 0.22), x = 90 + (d === 'sat' ? 0 : COLW) + 6, y = 60 + (st - H0) * ROW + 4, h = du * ROW - 8;
            return <div key={i} style={{ position: 'absolute', left: x, top: y, width: COLW - 12, height: h, overflow: 'hidden', borderRadius: 6 }}>
              {/* the block wipes down from its top edge: a solid colour, not a glow */}
              <div style={{ width: '100%', height: '100%', background: col === 'peri' ? PERI : LAV, color: NAVY, padding: '10px 14px', clipPath: `inset(0 0 ${(1 - k) * 100}% 0)` }}>
                <div style={{ fontFamily: inter, fontWeight: 400, fontSize: 22, letterSpacing: '0.02em' }}>{lab}</div>
                {h > 70 && <div style={{ fontFamily: inter, fontWeight: 300, fontSize: 18, marginTop: 4 }}>{tm}</div>}</div></div>;
          })}
        </div>
      </>)}
      {/* 3 · monday: the list stacks in, faster and faster */}
      {t >= C.monday - 0.05 && t < C.breath && (() => {
        const out = p(t, C.breath - 0.1, C.breath, IN);
        return <>
          <Wipe t={t} at={C.monday} style={{ left: 80, top: 400, fontFamily: serif, fontSize: 170, color: SOFT, lineHeight: 1, opacity: 1 - out }}>monday:</Wipe>
          <Label style={{ left: 80, top: 330, opacity: p(t, C.monday, C.monday + 0.2) * (1 - out) }}>{`${NOTES.filter(n => t >= n[0]).length * 3 + 3} things waiting`}</Label>
          {NOTES.map(([at, k, txt], i) => {
            const a = p(t, at, at + 0.2), n = NOTES.filter(nn => t >= nn[0]).length, slot = n - 1 - i;
            if (t < at) return null;
            return <div key={i} style={{ position: 'absolute', left: 80, width: 760, top: 640 + slot * 128 + bob, height: 112, borderRadius: 14, background: SOFT, color: NAVY,
              display: 'flex', alignItems: 'center', gap: 22, padding: '0 28px', opacity: (1 - out) * Math.min(1, a * 2), transform: `translateY(${(1 - a) * -60}px)`,
              boxShadow: '0 18px 30px -18px rgba(0,0,0,.6)' }}>
              <div style={{ width: 12, height: 12, borderRadius: 6, background: k === 'reply' ? LAV : PERI, flex: 'none' }} />
              <div><div style={{ fontFamily: inter, fontWeight: 400, fontSize: 20, letterSpacing: '0.12em', opacity: 0.55 }}>{k}</div>
                <div style={{ fontFamily: inter, fontWeight: 400, fontSize: 32, marginTop: 4 }}>{txt}</div></div></div>;
          })}
        </>;
      })()}
      {/* 4 · the breath: one input line on a clean stage */}
      {t >= C.breath && t < D + 0.6 && (() => {
        const a = p(t, C.breath, C.breath + 0.3), n = B.prompt.length, cur = Math.max(0, Math.min(n, (t - C.typeStart) / (C.typeEnd - C.typeStart) * n));
        const press = t >= D ? 1 - 0.06 * Math.sin(p(t, D, D + 0.14, Easing.linear) * Math.PI) : 1, gone2 = p(t, D + 0.12, D + 0.35, IN);
        return <div style={{ position: 'absolute', left: 80, top: 880, width: 760, opacity: 1 - gone2 }}>
          <Label style={{ left: 0, top: -64, opacity: a }}>mila</Label>
          <div style={{ position: 'absolute', left: 0, top: 110, width: 760 * a, height: 2, background: SOFT }} />
          <div style={{ position: 'absolute', left: 0, top: 30, fontFamily: inter, fontWeight: 300, fontSize: 38, color: SOFT, whiteSpace: 'nowrap' }}>
            {B.prompt.split('').map((ch, k) => <span key={k} style={{ opacity: p(t, C.typeStart + (k / n) * (C.typeEnd - C.typeStart), C.typeStart + (k / n) * (C.typeEnd - C.typeStart) + 0.06) }}>{ch}</span>)}
            <span style={{ display: 'inline-block', width: 3, height: 40, marginLeft: 4, verticalAlign: -6, background: PERI, opacity: t < D ? (Math.floor(t * 4) % 2 ? 0.35 : 1) : 0 }} /></div>
          {/* the send key: a crisp disc that fires the drop */}
          <div style={{ position: 'absolute', left: 680, top: 18, width: 80, height: 80, borderRadius: 40, background: PERI, transform: `scale(${a * press})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 18.5V5.5M6 11.5 12 5.5l6 6" /></svg></div>
        </div>;
      })()}
      {/* 5 · sent: the follow-ups cascade out as finished rows */}
      {t >= C.sent[0] - 0.05 && t < C.replies + 0.2 && SENT.map(([who, what], i) => {
        const at = C.sent[i], a = p(t, at, at + 0.22), o = p(t, C.replies - 0.12, C.replies + 0.1, IN);
        return <div key={i} style={{ position: 'absolute', left: 80, top: 760 + i * 128, width: 760, height: 112, borderRadius: 14, background: NAVY, color: SOFT,
          display: 'flex', alignItems: 'center', gap: 22, padding: '0 28px', clipPath: `inset(0 ${(1 - a) * 100}% 0 0)`, opacity: 1 - o, transform: `translateX(${o * 80}px)` }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={LAV} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          <div><div style={{ fontFamily: inter, fontWeight: 400, fontSize: 20, letterSpacing: '0.12em', opacity: 0.6 }}>sent · {who}</div>
            <div style={{ fontFamily: inter, fontWeight: 300, fontSize: 32, marginTop: 4 }}>{what}</div></div></div>;
      })}
      {t >= C.sent[0] - 0.05 && t < C.replies + 0.2 && <Wipe t={t} at={C.sent[0]} out={C.replies - 0.15} style={{ left: 80, top: 520, fontFamily: serif, fontSize: 130, color: NAVY, lineHeight: 1 }}>all sent.</Wipe>}
      {/* 6 · the replies come back */}
      {t >= C.replies - 0.05 && t < C.clients + 0.2 && (<>
        <Wipe t={t} at={C.replies} out={C.clients - 0.15} style={{ left: 80, top: 520, fontFamily: serif, fontSize: 130, color: NAVY, lineHeight: 1 }}>replies.</Wipe>
        {REPLIES.map(([who, what], i) => {
          const at = C.replyRows[i], a = p(t, at, at + 0.22), o = p(t, C.clients - 0.12, C.clients + 0.1, IN);
          return <div key={i} style={{ position: 'absolute', left: 240, top: 760 + i * 128, width: 760, height: 112, borderRadius: 14, background: SOFT, color: NAVY,
            display: 'flex', alignItems: 'center', gap: 22, padding: '0 28px', clipPath: `inset(0 0 0 ${(1 - a) * 100}%)`, opacity: 1 - o, transform: `translateX(${-o * 80}px)` }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: i === 2 ? '#2e9e6a' : PERI, flex: 'none' }} />
            <div><div style={{ fontFamily: inter, fontWeight: 400, fontSize: 20, letterSpacing: '0.12em', opacity: 0.55 }}>{who}</div>
              <div style={{ fontFamily: inter, fontWeight: 400, fontSize: 32, marginTop: 4 }}>{what}</div></div></div>;
        })}
      </>)}
      {/* 7 · the point */}
      {t >= C.clients - 0.05 && t < C.mila + 0.2 && (<>
        <Wipe t={t} at={C.clients} out={C.mila - 0.15} style={{ left: 80, top: 640, fontFamily: serif, fontSize: 150, color: NAVY, lineHeight: 1 }}>monday’s for</Wipe>
        <Wipe t={t} at={C.clients2} out={C.mila - 0.15} style={{ left: 80, top: 800, fontFamily: serif, fontStyle: 'italic', fontSize: 150, color: NAVY, lineHeight: 1 }}>clients.</Wipe>
      </>)}
      {/* 8 · the lockup */}
      {t >= C.mila - 0.05 && (<>
        <Wipe t={t} at={C.mila} dur={0.4} style={{ left: 0, right: 0, top: 560, textAlign: 'center', fontFamily: serif, fontSize: 280, color: NAVY, lineHeight: 1 }}>Mila</Wipe>
        <div style={{ position: 'absolute', left: 540 - 200 * p(t, C.tagline - 0.1, C.tagline + 0.3), top: 900, height: 2, width: 400 * p(t, C.tagline - 0.1, C.tagline + 0.3), background: NAVY, opacity: 0.35 }} />
        <Wipe t={t} at={C.tagline} style={{ left: 0, right: 0, top: 930, textAlign: 'center', fontFamily: serif, fontSize: 80, color: NAVY, lineHeight: 1 }}>say it once.</Wipe>
        <Wipe t={t} at={C.cta} dur={0.25} style={{ left: 0, right: 0, top: 1080, textAlign: 'center', fontFamily: inter, fontWeight: 300, fontSize: 34, color: NAVY }}>comment MILA for your 7-day free trial</Wipe>
      </>)}
    </AbsoluteFill>
  );
};

const Bg: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const t = frame / fps; const D = C.drop;
  const bass = B.bass[Math.min(B.bass.length - 1, frame)];
  // the drop: a crisp periwinkle disc fires from the send key and takes the frame, thin rings race ahead of it
  const r = p(t, D, D + 0.5) * 2300, sx = 80 + 720, sy = 880 + 58;
  const toLav = p(t, C.sent[2], C.mila);                          // the field settles from periwinkle into lavender for the lockup
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY }}>
      {/* a fine dot grid: structure, not decoration */}
      <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(247,245,255,.10) 1.2px, transparent 1.3px)', backgroundSize: '40px 40px', opacity: 0.55 + 0.9 * accent(t, 9) }} />
      {/* a single breathing band of light at the bottom edge, driven by the bass (kept small and graphic) */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 6 + 10 * bass + 30 * accent(t, 12), background: `linear-gradient(90deg, ${PERI}, ${LAV})`, opacity: t < D ? 0.9 : 0 }} />
      {t >= D && <div style={{ position: 'absolute', left: sx - r, top: sy - r, width: r * 2, height: r * 2, borderRadius: '50%', background: toLav > 0 ? `color-mix(in srgb, ${PERI} ${100 - toLav * 100}%, ${LAV})` : PERI }} />}
      {t >= D && [0, 1, 2].map(i => { const q = p(t, D + i * 0.06, D + 0.7 + i * 0.06); const rr = 40 + q * 1500;
        return <div key={i} style={{ position: 'absolute', left: sx - rr, top: sy - rr, width: rr * 2, height: rr * 2, borderRadius: '50%', border: `2px solid ${i % 2 ? LAV : SOFT}`, opacity: (1 - q) * 0.9 }} />; })}
      {/* lockup field: a fine navy hairline frame once the lockup lands */}
      {t >= C.mila && <div style={{ position: 'absolute', left: 60, top: 300, right: 60, bottom: 420, border: `1px solid rgba(26,26,46,${0.25 * p(t, C.mila, C.mila + 0.4)})` }} />}
    </AbsoluteFill>
  );
};

export const TeaserV2: React.FC<{ withAudio: boolean }> = ({ withAudio }) => {
  const frame = useCurrentFrame(); const t = frame / 60;
  const push = 1 + 0.04 * p(t, 0, B.duration, Easing.bezier(0.45, 0, 0.55, 1));
  const kick = 1 + 0.03 * decay(t, C.drop, 7) + 0.008 * accent(t, 14);   // the big punch on the drop + a small one on every hit
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY }}>
      <AbsoluteFill style={{ transform: `scale(${push * kick})` }}>
        <Bg />
        <CameraMotionBlur samples={6} shutterAngle={180}><Fg /></CameraMotionBlur>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(5,5,16,.35) 100%)', mixBlendMode: 'multiply' }} />
      <AbsoluteFill style={{ opacity: 0.08, mixBlendMode: 'overlay' }}>
        <Img src={staticFile(`grain/g${String(frame % 12).padStart(2, '0')}.png`)} style={{ width: 1080, height: 1920 }} />
      </AbsoluteFill>
      {withAudio && <Audio src={staticFile('audio/mix_v2.wav')} />}
    </AbsoluteFill>
  );
};
