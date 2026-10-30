import type { At, Edit } from './types';

// A scene time -> reel frame. { word: n } uses word n of captions.json as placed by the cut.
export const resolveAt = (at: At | undefined, edit: Edit | null, fps: number, fallback = 0): number => {
  if (at === undefined) return fallback;
  if (typeof at === 'number') return Math.round(at);
  const w = edit?.captions.find((c) => c.i === at.word);
  if (!w) return fallback; // the word was cut: the item is skipped by the caller when fallback is -1
  return Math.round((w.startMs / 1000) * fps) + (at.offset ?? 0);
};
