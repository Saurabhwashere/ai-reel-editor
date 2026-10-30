import { Composition, staticFile, type CalculateMetadataFunction } from 'remotion';
import { parseMedia } from '@remotion/media-parser';
import { Cutout, type CutoutProps } from './Cutout';
import { Reel, type ReelProps } from './Reel';
import type { Edit, Scene } from './types';

export const FPS = 30;

const loadJson = async <T,>(file: string): Promise<T | null> => {
  const res = await fetch(staticFile(file)).catch(() => null);
  return res?.ok ? ((await res.json()) as T) : null;
};

// Reads public/edit.json (the cut) and public/scene.json (layouts, graphics, sound) and measures screen recordings.
// Without edit.json the reel is the whole clip.
const calculateMetadata: CalculateMetadataFunction<ReelProps> = async ({ props }) => {
  const edit = await loadJson<Edit>('edit.json');
  const scene = (await loadJson<Scene>('scene.json')) ?? {};
  const screenSizes: ReelProps['screenSizes'] = {};
  for (const g of scene.graphics ?? []) {
    if (g.kind !== 'screen' || screenSizes[g.src]) continue;
    const { dimensions } = await parseMedia({ src: staticFile(g.src), fields: { dimensions: true }, acknowledgeRemotionLicense: true });
    if (dimensions) screenSizes[g.src] = { w: dimensions.width, h: dimensions.height };
  }
  let durationInFrames = edit?.durationInFrames ?? 0;
  if (!edit) {
    const { slowDurationInSeconds } = await parseMedia({ src: staticFile(props.clip), fields: { slowDurationInSeconds: true }, acknowledgeRemotionLicense: true });
    durationInFrames = Math.floor(slowDurationInSeconds * FPS);
  }
  return { durationInFrames: Math.max(1, durationInFrames), props: { ...props, edit, scene, screenSizes } };
};

export const RemotionRoot: React.FC = () => (
  <>
  <Composition
    id="Reel"
    component={Reel}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={FPS * 5}
    defaultProps={{ clip: 'clip.mp4', title: '', safeZone: false, captions: true, edit: null, scene: {}, screenSizes: {} } satisfies ReelProps}
    calculateMetadata={calculateMetadata}
  />
  {/* used by scripts/cutout.mjs only */}
  <Composition
    id="Cutout"
    component={Cutout}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={1}
    defaultProps={{ from: 0, count: 1 } satisfies CutoutProps}
    calculateMetadata={async ({ props }) => ({ durationInFrames: Math.max(1, props.count) })}
  />
  </>
);
