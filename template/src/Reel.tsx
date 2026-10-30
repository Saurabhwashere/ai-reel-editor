import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Captions } from './Captions';
import './fonts';
import { BehindText, CutoutLayer } from './Effects';
import { GraphicView, HookView } from './Graphics';
import { H, layoutAt, rectStyle, type ResolvedLayout } from './Layouts';
import { SafeZone } from './SafeZone';
import { ScreenSizes } from './ScreenClip';
import { MusicBed, SoundEffects, type PlacedSfx } from './Soundtrack';
import { resolveAt } from './time';
import type { Edit, Scene, Segment } from './types';

export type ReelProps = {
  clip: string; // file name inside public/
  title: string; // quick hook text when scene.json has no hook
  safeZone: boolean; // draw Instagram's button areas in red (preview only)
  captions: boolean; // word-by-word captions from edit.json
  edit: Edit | null; // filled in from public/edit.json by Root
  scene: Scene; // filled in from public/scene.json by Root
  screenSizes: Record<string, { w: number; h: number }>; // filled in by Root
};

const videoStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 30%' };

// One kept part of the clip. A 1-frame volume ramp at each end stops clicks at the cut.
const Part: React.FC<{ clip: string; seg: Segment }> = ({ clip, seg }) => {
  const len = seg.toFrame - seg.fromFrame;
  return (
    <Sequence from={seg.startFrame} durationInFrames={len} premountFor={15}>
      <OffthreadVideo src={staticFile(clip)} trimBefore={seg.fromFrame} style={{ ...videoStyle, position: 'absolute', inset: 0 }} volume={(f) => Math.min(1, f + 0.5, len - f - 0.5)} />
    </Sequence>
  );
};

export const Reel: React.FC<ReelProps> = ({ clip, title, safeZone, captions, edit, scene, screenSizes }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: total } = useVideoConfig();
  const at = (a: Parameters<typeof resolveAt>[0], fallback = -1) => resolveAt(a, edit, fps, fallback);

  const layouts: ResolvedLayout[] = (scene.layouts ?? []).map((l) => ({ at: at(l.at), kind: l.kind })).filter((l) => l.at >= 0);
  const layout = layoutAt(frame, layouts);
  // split: graphics stop above the strip where the captions sit; screen recordings keep the whole half
  const CAPTION_STRIP = 150;
  const slot = layout.hasContent ? layout.content : null;
  const graphicSlot = slot && layout.kind === 'split' ? { ...slot, h: slot.h - CAPTION_STRIP } : slot;

  // Graphics whose start word was cut are skipped; `until` defaults to 2 seconds later
  const graphics = (scene.graphics ?? [])
    .map((g) => {
      const from = at(g.at);
      const to = at(g.until, from + fps * 2);
      const itemFrames = g.kind === 'list' ? g.items.map((it) => at(it.at, from) - from) : undefined;
      return { g, from, len: Math.max(1, to - from), itemFrames, index: scene.graphics!.indexOf(g) };
    })
    .filter((x) => x.from >= 0);
  const screens = graphics.filter((x) => x.g.kind === 'screen');
  const behind = graphics.filter((x) => x.g.kind === 'behind');
  const overlays = graphics.filter((x) => x.g.kind !== 'screen' && x.g.kind !== 'behind');

  const hook = scene.hook ?? (title ? { text: title, variant: 'plain' as const } : null);
  const hookLen = hook ? at(hook.until, fps * 2.5) : 0;

  const cues: PlacedSfx[] = [
    ...(scene.sfx ?? []).map((s) => ({ at: at(s.at), sound: s.sound, volume: s.volume ?? 0.45 })),
    ...graphics.filter((x) => x.g.sfx).map((x) => ({ at: x.from, sound: x.g.sfx!, volume: 0.4 })),
    ...(scene.layouts ?? []).filter((l) => l.sfx).map((l) => ({ at: at(l.at), sound: l.sfx!, volume: 0.4 })),
  ].filter((c) => c.at >= 0 && c.at < total);

  return (
    <ScreenSizes.Provider value={screenSizes}>
      <AbsoluteFill style={{ backgroundColor: 'black' }}>
        {/* the speaker: one set of players for the whole reel, moved and cropped by the layout */}
        {/* in pip the speaker bubble sits above the screen recording */}
        <div style={{ ...rectStyle(layout.speaker), zIndex: layout.kind === 'pip' ? 2 : 0 }}>
          {edit ? edit.segments.map((seg) => <Part key={seg.startFrame} clip={clip} seg={seg} />) : <OffthreadVideo src={staticFile(clip)} style={videoStyle} />}
        </div>
        {/* text behind the head: words on the speaker, then the cut-out speaker back on top */}
        {behind.map(({ g, from, len, index }) => (
          <Sequence key={`b${index}`} from={from} durationInFrames={len}>
            {g.kind === 'behind' ? <BehindText text={g.text} highlight={g.highlight} y={g.y ?? 300} len={len} /> : null}
            <CutoutLayer graphic={index} from={from} />
          </Sequence>
        ))}
        {/* a panel behind graphics in layouts with a content box, so it never shows bare black */}
        {layout.content.opacity > 0 ? <div style={{ ...rectStyle(layout.content), background: 'radial-gradient(circle at 50% 35%, #2b2f3d 0%, #14161d 60%, #0b0c10 100%)' }} /> : null}
        {screens.map(({ g, from, len }, i) => (
          <Sequence key={`s${i}`} from={from} durationInFrames={len} premountFor={20}>
            <GraphicView g={g} len={len} slot={slot} />
          </Sequence>
        ))}
        {layout.kind === 'pip' ? <div style={{ ...rectStyle(layout.speaker), zIndex: 3, overflow: 'visible', border: '6px solid white', boxSizing: 'border-box', boxShadow: '0 12px 40px rgba(0,0,0,0.45)' }} /> : null}
        <AbsoluteFill style={{ zIndex: 4 }}>
        {overlays.map(({ g, from, len, itemFrames }, i) => (
          <Sequence key={`g${i}`} from={from} durationInFrames={len} layout="none">
            <GraphicView g={g} len={len} slot={graphicSlot} itemFrames={itemFrames} />
          </Sequence>
        ))}
        </AbsoluteFill>
        {/* split: captions sit on the line between content and speaker, off the face */}
        {captions && edit ? <AbsoluteFill style={{ zIndex: 4 }}><Captions captions={edit.captions} bottomPx={layout.kind === 'split' ? H / 2 - 70 : undefined} pill={layout.kind === 'full' || layout.kind === 'pip'} /></AbsoluteFill> : null}
        {hook ? (
          <Sequence durationInFrames={Math.max(1, hookLen)} style={{ zIndex: 5 }}>
            <HookView text={hook.text} variant={hook.variant ?? 'box'} len={Math.max(1, hookLen)} />
          </Sequence>
        ) : null}
        {scene.music ? <MusicBed music={scene.music} words={edit?.captions ?? []} /> : null}
        <SoundEffects cues={cues} />
        {safeZone ? <SafeZone /> : null}
      </AbsoluteFill>
    </ScreenSizes.Provider>
  );
};
