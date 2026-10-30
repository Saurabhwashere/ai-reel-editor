import type { Caption } from '@remotion/captions';

// public/edit.json, written by scripts/cut.mjs. Frames are in the original clip (from/to) and the reel (start).
export type Segment = { fromFrame: number; toFrame: number; startFrame: number };
// `i` = the word's number in captions.json, so a scene can point at a word and survive a re-cut
export type EditCaption = Caption & { i: number };
export type Edit = { fps: number; durationInFrames: number; segments: Segment[]; captions: EditCaption[] };

// public/scene.json, written by Claude after the storyboard is approved. See references/scene.md.
// A time is a reel frame (number) or a spoken word: { "word": 12 } = when word 12 of captions.json starts.
export type At = number | { word: number; offset?: number };

export type LayoutKind = 'talking' | 'split' | 'full' | 'pip';
export type LayoutChange = { at: At; kind: LayoutKind; sfx?: string };

export type HookVariant = 'box' | 'dark' | 'plain';
export type Hook = { text: string; variant?: HookVariant; until?: At };

export type CursorKey = { at: number; x: number; y: number; click?: boolean }; // at = frame inside the clip; x/y 0..1 on the screen
export type Camera = { at: number; x: number; y: number; zoom: number }; // at = frame inside the clip; x/y 0..1 = point to centre

type Base = { at: At; until: At; sfx?: string };
export type Graphic = Base &
  (
    | { kind: 'headline'; text: string; highlight?: string[] } // big words in the band above the head, one by one
    | { kind: 'keyword'; text: string } // one word, huge, with an underline sweep
    | { kind: 'list'; title?: string; items: { text: string; at: At }[] } // items appear on their own beats
    | { kind: 'stat'; value: number; prefix?: string; suffix?: string; label: string } // number counts up
    | { kind: 'image'; src: string; caption?: string } // screenshot or photo from public/images, big and centred
    | { kind: 'tag'; title: string; subtitle?: string } // name tag / handle, bottom-left
    | { kind: 'screen'; src: string; trimBefore?: number; camera?: Camera[]; cursor?: CursorKey[] } // screen recording from public/screens
    | { kind: 'behind'; text: string; highlight?: string[]; y?: number } // huge words behind the head; needs scripts/cutout.mjs
    | { kind: 'card3d'; text: string; subtitle?: string } // real 3D card that spins in
    | { kind: 'glass'; text: string; subtitle?: string } // liquid-glass panel
    | { kind: 'shader'; effect: 'leak' | 'sweep' | 'ripple' } // GPU light effect over the picture
    | { kind: 'hyperframe'; src: string } // transparent effect rendered by HyperFrames, from public/hyperframes
  );

export type Sfx = { at: At; sound: string; volume?: number };
export type Music = { src: string; volume?: number; trimBefore?: number };

export type Scene = {
  hook?: Hook;
  layouts?: LayoutChange[];
  graphics?: Graphic[];
  music?: Music;
  sfx?: Sfx[];
};
