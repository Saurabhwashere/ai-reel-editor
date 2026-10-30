import { createContext, useContext } from 'react';
import { Easing, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from 'remotion';
import type { Rect } from './Layouts';
import type { Camera, CursorKey } from './types';

// Screen-recording sizes, measured once in Root's calculateMetadata (src -> width/height)
export const ScreenSizes = createContext<Record<string, { w: number; h: number }>>({});

const ease = Easing.bezier(0.45, 0, 0.2, 1); // slow in, settles gently: reads like a camera operator

// Camera at a frame: holds the first key before it, the last key after it, eases between keys
const cameraAt = (frame: number, keys: Camera[]): Camera => {
  if (!keys.length) return { at: 0, x: 0.5, y: 0.5, zoom: 1 };
  const k = [...keys].sort((a, b) => a.at - b.at);
  if (frame <= k[0].at) return k[0];
  for (let i = 0; i + 1 < k.length; i++) {
    const a = k[i], b = k[i + 1];
    if (frame <= b.at) {
      const t = interpolate(frame, [a.at, Math.max(a.at + 1, b.at)], [0, 1], { easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      return { at: frame, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, zoom: a.zoom + (b.zoom - a.zoom) * t };
    }
  }
  return k[k.length - 1];
};

// Keep the picture covering the box on any side where it is bigger than the box; centre it where it is smaller.
// Each axis is decided on its own, so a zoom passing the box size never snaps.
const place = (box: number, size: number, focus: number) => {
  const want = box / 2 - focus * size;
  return size >= box ? Math.min(0, Math.max(box - size, want)) : (box - size) / 2;
};

// A smooth pointer drawn over the recording, for recordings made with the system cursor hidden.
// Glides between keys with the same ease as the camera; a click shrinks it and sends out a ring.
const Cursor: React.FC<{ keys: CursorKey[]; frame: number; toScreen: (x: number, y: number) => { x: number; y: number } }> = ({ keys, frame, toScreen }) => {
  const k = [...keys].sort((a, b) => a.at - b.at);
  const pos = cameraAt(frame, k.map((c) => ({ at: c.at, x: c.x, y: c.y, zoom: 1 })));
  const p = toScreen(pos.x, pos.y);
  const click = [...k].reverse().find((c) => c.click && frame >= c.at);
  const since = click ? frame - click.at : 99;
  const press = interpolate(since, [0, 3, 8], [0.8, 0.8, 1], { extrapolateRight: 'clamp' });
  const ring = interpolate(since, [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <>
      {since < 16 ? <div style={{ position: 'absolute', left: p.x - 50, top: p.y - 50, width: 100, height: 100, borderRadius: 50, border: '5px solid #FFE14D', opacity: 1 - ring, transform: `scale(${0.3 + ring})` }} /> : null}
      <svg width="56" height="56" viewBox="0 0 24 24" style={{ position: 'absolute', left: p.x - 8, top: p.y - 4, transform: `scale(${press})`, transformOrigin: '8px 4px', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.45))' }}>
        <path d="M5 2l14 12-7 .8 4 7-3 1.6-4-7.2L4 21z" fill="white" stroke="#111" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    </>
  );
};

export const ScreenClip: React.FC<{ src: string; trimBefore: number; camera: Camera[]; cursor?: CursorKey[]; box: Rect; len: number }> = ({ src, trimBefore, camera, cursor = [], box }) => {
  const frame = useCurrentFrame();
  const size = useContext(ScreenSizes)[src] ?? { w: 1920, h: 1080 };
  const cam = cameraAt(frame, camera);
  const fit = Math.min(box.w / size.w, box.h / size.h); // whole screen visible at zoom 1
  const cw = size.w * fit * Math.max(1, cam.zoom);
  const ch = size.h * fit * Math.max(1, cam.zoom);
  const left = place(box.w, cw, cam.x);
  const top = place(box.h, ch, cam.y);

  return (
    <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, opacity: box.opacity, overflow: 'hidden', borderRadius: box.radius, background: 'radial-gradient(circle at 50% 40%, #2a2d3a, #0b0c10)' }}>
      {/* muted: screen recordings carry system sounds nobody wants. One player per file (two on one file can stall the render). */}
      <OffthreadVideo
        src={staticFile(src)}
        muted
        trimBefore={trimBefore}
        style={{ position: 'absolute', left, top, width: cw, height: ch, borderRadius: cam.zoom < 1.05 ? 18 : 0, boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}
      />
      {cursor.length ? <Cursor keys={cursor} frame={frame} toScreen={(x, y) => ({ x: left + x * cw, y: top + y * ch })} /> : null}
    </div>
  );
};
