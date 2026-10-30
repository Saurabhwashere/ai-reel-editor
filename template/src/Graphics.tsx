import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT } from './fonts';
import type { Rect } from './Layouts';
import { SAFE } from './SafeZone';
import { Card3D, Glass, HyperframeClip, Shader } from './Effects';
import { ScreenClip } from './ScreenClip';
import type { Graphic, HookVariant } from './types';

// Every graphic gets: local frame 0 = its start, `len` frames on screen, and `slot` = the layout's content box
// (null in the talking layout, where it floats over the speaker instead).
type Props<G> = { g: G; len: number; slot: Rect | null; itemFrames?: number[] };

const YELLOW = '#FFE14D';
const shadow = '0 6px 28px rgba(0,0,0,0.55)';
const OUT = 6; // frames to leave

// Enters already moving (no slow fade-in), leaves with a quick shrink
const useEnterExit = (len: number) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 15, stiffness: 180 } });
  const exit = interpolate(f, [len - OUT, len], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return { f, fps, enter, exit };
};

// The clear band above the speaker's head, inside the safe zone
const Band: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ top: SAFE.top + 40, height: 560, left: SAFE.left + 30, right: SAFE.right + 30, width: 'auto', justifyContent: 'center', alignItems: 'center' }}>
    {children}
  </AbsoluteFill>
);

// A box (the layout's slot, or a centred card when there is none)
const Box: React.FC<{ slot: Rect | null; children: React.ReactNode; pad?: number }> = ({ slot, children, pad = 70 }) => {
  const r = slot ?? { x: 70, y: 380, w: 940, h: 940, radius: 0, opacity: 1 };
  const top = Math.max(r.y, SAFE.top); // starts below Instagram's top bar, ends at the slot's own bottom edge
  const bottom = Math.min(r.y + r.h, 1920 - SAFE.bottom);
  return (
    <div style={{ position: 'absolute', left: r.x + pad / 2, top: top + pad / 2, width: r.w - pad, height: bottom - top - pad, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {children}
    </div>
  );
};

const Headline: React.FC<Props<Extract<Graphic, { kind: 'headline' }>>> = ({ g, len }) => {
  const { f, fps, exit } = useEnterExit(len);
  const words = g.text.split(/\s+/);
  const hi = new Set((g.highlight ?? []).map((w) => w.toLowerCase()));
  return (
    <Band>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: words.length > 5 ? 92 : 118, lineHeight: 1.02, textAlign: 'center', letterSpacing: '-0.02em', opacity: exit, transform: `scale(${0.9 + exit * 0.1})` }}>
        {words.map((w, i) => {
          const s = spring({ frame: f - i * 3, fps, config: { damping: 13, stiffness: 200 } });
          const color = hi.has(w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')) ? YELLOW : 'white';
          return (
            <span key={i} style={{ display: 'inline-block', margin: '0 0.14em', color, textShadow: shadow, opacity: s, transform: `translateY(${(1 - s) * 60}px) scale(${0.7 + s * 0.3})` }}>
              {w}
            </span>
          );
        })}
      </div>
    </Band>
  );
};

const Keyword: React.FC<Props<Extract<Graphic, { kind: 'keyword' }>>> = ({ g, len }) => {
  const { f, enter, exit } = useEnterExit(len);
  const sweep = interpolate(f, [4, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  return (
    <Band>
      <div style={{ opacity: exit, transform: `scale(${(1.5 - enter * 0.5) * (0.85 + exit * 0.15)})`, textAlign: 'center' }}>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: g.text.length > 8 ? 150 : 190, color: 'white', textShadow: shadow, letterSpacing: '-0.03em', lineHeight: 1 }}>{g.text}</div>
        <div style={{ height: 18, marginTop: 14, background: YELLOW, borderRadius: 9, width: `${sweep * 100}%` }} />
      </div>
    </Band>
  );
};

const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ background: 'rgba(14,14,18,0.88)', borderRadius: 36, padding: '48px 56px', boxShadow: '0 30px 80px rgba(0,0,0,0.45)', border: '2px solid rgba(255,255,255,0.08)', ...style }}>{children}</div>
);

const List: React.FC<Props<Extract<Graphic, { kind: 'list' }>>> = ({ g, len, slot, itemFrames = [] }) => {
  const { f, fps, enter, exit } = useEnterExit(len);
  const compact = g.items.length > 3; // 4+ items must still fit the top half in a split
  return (
    <Box slot={slot}>
      <Card style={{ width: '100%', opacity: exit, ...(compact ? { padding: '36px 48px' } : {}), transform: `translateY(${(1 - enter) * 80}px)` }}>
        {g.title ? <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: compact ? 54 : 64, color: YELLOW, marginBottom: compact ? 14 : 28 }}>{g.title}</div> : null}
        {g.items.map((it, i) => {
          const s = spring({ frame: f - (itemFrames[i] ?? i * 12), fps, config: { damping: 14 } });
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: compact ? 20 : 26, margin: compact ? '6px 0' : '14px 0', opacity: s, transform: `translateX(${(1 - s) * -90}px)` }}>
              <div style={{ flexShrink: 0, width: compact ? 52 : 72, height: compact ? 52 : 72, borderRadius: 36, background: YELLOW, color: '#111', fontFamily: FONT, fontWeight: 900, fontSize: compact ? 30 : 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: compact ? 48 : 62, color: 'white', lineHeight: 1.1 }}>{it.text}</div>
            </div>
          );
        })}
      </Card>
    </Box>
  );
};

const Stat: React.FC<Props<Extract<Graphic, { kind: 'stat' }>>> = ({ g, len, slot }) => {
  const { f, enter, exit } = useEnterExit(len);
  const t = interpolate(f, [0, 24], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const n = Math.round(g.value * t).toLocaleString('en-US');
  const inner = (
    <div style={{ textAlign: 'center', opacity: exit, transform: `scale(${0.8 + enter * 0.2})` }}>
      <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 220, color: YELLOW, textShadow: shadow, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {g.prefix ?? ''}{n}{g.suffix ?? ''}
      </div>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 60, color: 'white', textShadow: shadow, marginTop: 12 }}>{g.label}</div>
    </div>
  );
  return slot ? <Box slot={slot}>{inner}</Box> : <Band>{inner}</Band>;
};

const ImageCard: React.FC<Props<Extract<Graphic, { kind: 'image' }>>> = ({ g, len, slot }) => {
  const { enter, exit } = useEnterExit(len);
  return (
    <Box slot={slot} pad={slot ? 80 : 0}>
      <div style={{ maxWidth: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: exit, transform: `translateY(${(1 - enter) * 220}px) rotate(${(1 - enter) * -4}deg) scale(${0.92 + exit * 0.08})` }}>
        <Img src={staticFile(g.src)} style={{ maxWidth: '100%', maxHeight: g.caption ? '86%' : '100%', objectFit: 'contain', borderRadius: 28, boxShadow: '0 30px 90px rgba(0,0,0,0.5)' }} />
        {g.caption ? <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 48, color: 'white', textShadow: shadow, marginTop: 24, textAlign: 'center' }}>{g.caption}</div> : null}
      </div>
    </Box>
  );
};

const Tag: React.FC<Props<Extract<Graphic, { kind: 'tag' }>>> = ({ g, len }) => {
  const { enter, exit } = useEnterExit(len);
  return (
    <div style={{ position: 'absolute', left: SAFE.left + 30, top: SAFE.top + 60, opacity: exit, transform: `translateX(${(1 - enter) * -120}px)`, display: 'flex', alignItems: 'stretch' }}>
      <div style={{ width: 12, background: YELLOW, borderRadius: 6, marginRight: 22 }} />
      <div>
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 58, color: 'white', textShadow: shadow }}>{g.title}</div>
        {g.subtitle ? <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 40, color: 'rgba(255,255,255,0.85)', textShadow: shadow }}>{g.subtitle}</div> : null}
      </div>
    </div>
  );
};

export const GraphicView: React.FC<Props<Graphic>> = (p) => {
  switch (p.g.kind) {
    case 'headline': return <Headline {...p} g={p.g} />;
    case 'keyword': return <Keyword {...p} g={p.g} />;
    case 'list': return <List {...p} g={p.g} />;
    case 'stat': return <Stat {...p} g={p.g} />;
    case 'image': return <ImageCard {...p} g={p.g} />;
    case 'tag': return <Tag {...p} g={p.g} />;
    case 'card3d': return <Card3D text={p.g.text} subtitle={p.g.subtitle} len={p.len} />;
    case 'glass': return <Glass text={p.g.text} subtitle={p.g.subtitle} len={p.len} id={`glass-${p.g.text.length}`} />;
    case 'shader': return <Shader effect={p.g.effect} len={p.len} />;
    case 'hyperframe': return <HyperframeClip src={p.g.src} />;
    case 'behind': return null; // drawn by Reel, between the speaker and the cut-out
    case 'screen': return <ScreenClip src={p.g.src} trimBefore={p.g.trimBefore ?? 0} camera={p.g.camera ?? []} cursor={p.g.cursor ?? []} box={p.slot ?? { x: 0, y: 0, w: 1080, h: 1920, radius: 0, opacity: 1 }} len={p.len} />;
  }
};

// The opening text hook, in the band above the head
export const HookView: React.FC<{ text: string; variant: HookVariant; len: number }> = ({ text, variant, len }) => {
  const { enter, exit } = useEnterExit(len);
  const look: Record<HookVariant, React.CSSProperties> = {
    box: { background: 'white', color: '#111', padding: '18px 34px', borderRadius: 22, boxShadow: '0 16px 50px rgba(0,0,0,0.35)' },
    dark: { background: '#111', color: 'white', padding: '18px 34px', borderRadius: 22, boxShadow: '0 16px 50px rgba(0,0,0,0.35)' },
    plain: { color: 'white', textShadow: shadow },
  };
  return (
    <Band>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: text.length > 40 ? 64 : 78, lineHeight: 1.15, textAlign: 'center', maxWidth: 860, opacity: exit, transform: `translateY(${(1 - enter) * -50}px) scale(${0.94 + enter * 0.06})`, ...look[variant] }}>
        {text}
      </div>
    </Band>
  );
};
