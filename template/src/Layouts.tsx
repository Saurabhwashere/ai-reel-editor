import { Easing, interpolate } from 'remotion';
import type { LayoutKind } from './types';

export const W = 1080;
export const H = 1920;
export type Rect = { x: number; y: number; w: number; h: number; radius: number; opacity: number };

// Where the speaker and the content (graphic or screen recording) sit in each layout
//   talking  speaker fills the frame; graphics float over it
//   split    content on top, speaker below
//   full     content fills the frame; speaker hidden (voice keeps playing)
//   pip      content fills the frame; speaker in a round bubble, top-right inside the safe zone (sites keep nav top-left)
const full: Rect = { x: 0, y: 0, w: W, h: H, radius: 0, opacity: 1 };
export const LAYOUTS: Record<LayoutKind, { speaker: Rect; content: Rect | null }> = {
  talking: { speaker: full, content: null },
  split: { speaker: { ...full, y: H / 2, h: H / 2 }, content: { ...full, h: H / 2 } },
  full: { speaker: { ...full, opacity: 0 }, content: full },
  pip: { speaker: { x: 660, y: 250, w: 280, h: 280, radius: 140, opacity: 1 }, content: full },
};

const SWITCH_FRAMES = 9;
const ease = Easing.bezier(0.65, 0, 0.35, 1);

const mix = (a: Rect, b: Rect, t: number): Rect => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  w: a.w + (b.w - a.w) * t,
  h: a.h + (b.h - a.h) * t,
  radius: a.radius + (b.radius - a.radius) * t,
  opacity: a.opacity + (b.opacity - a.opacity) * t,
});

export type ResolvedLayout = { at: number; kind: LayoutKind };

// The layout at `frame`, sliding from the previous one over SWITCH_FRAMES
export const layoutAt = (frame: number, changes: ResolvedLayout[]) => {
  const sorted = [{ at: -Infinity, kind: 'talking' as LayoutKind }, ...changes].sort((a, b) => a.at - b.at);
  let i = 0;
  while (i + 1 < sorted.length && sorted[i + 1].at <= frame) i++;
  const cur = sorted[i];
  const prev = sorted[Math.max(0, i - 1)];
  const t = i === 0 ? 1 : interpolate(frame - cur.at, [0, SWITCH_FRAMES], [0, 1], { extrapolateRight: 'clamp', easing: ease });
  const a = LAYOUTS[prev.kind];
  const b = LAYOUTS[cur.kind];
  // content slides in from where it would be; a layout without content keeps the next one's box, faded
  const ca = a.content ?? { ...(b.content ?? full), opacity: 0 };
  const cb = b.content ?? { ...(a.content ?? full), opacity: 0 };
  return { kind: cur.kind, speaker: mix(a.speaker, b.speaker, t), content: mix(ca, cb, t), hasContent: b.content !== null };
};

export const rectStyle = (r: Rect): React.CSSProperties => ({
  position: 'absolute',
  left: r.x,
  top: r.y,
  width: r.w,
  height: r.h,
  borderRadius: r.radius,
  opacity: r.opacity,
  overflow: 'hidden',
});
