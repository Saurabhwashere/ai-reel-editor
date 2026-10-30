// Cuts every silence out of public/clip.mp4 -> public/edit.json (segments to keep + captions on the new timeline).
// Nothing is re-encoded here: Remotion plays the kept segments back to back at render time.
//
//   node scripts/cut.mjs [--gap 0.1] [--pad 0.05] [--drop "3,7"]
//
// --gap   longest pause (seconds) left in; longer ones are cut. Default 0.1.
// --pad   breathing room (seconds) kept before and after speech. Default 0.05.
// --drop  word numbers (from captions.json, starting at 0) to remove, e.g. a repeated take or "um". Ranges work: "4-9,20".
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FPS, PUBLIC, audioSeconds, durationSeconds, ff } from './lib.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const GAP = Number(arg('gap', 0.1));
const PAD = Number(arg('pad', 0.05));
const DROP = new Set(String(arg('drop', '')).split(',').filter(Boolean).flatMap((p) => {
  const [a, b = a] = p.split('-').map(Number);
  return Array.from({ length: b - a + 1 }, (_, k) => a + k);
}));
const NOISE_DB = -38; // quieter than this counts as silence

const clip = join(PUBLIC, 'clip.mp4');
const words = JSON.parse(readFileSync(join(PUBLIC, 'captions.json'), 'utf8'));
const total = Math.min(durationSeconds(clip), audioSeconds(clip));

// Whisper can time the last words at or past the end of the audio. Spread those over the time between
// the last well-timed word and the end, so they are captioned instead of dropped.
const endMs = total * 1000 - 34; // one frame before the end
const late = words.findIndex((w) => w.startMs >= endMs);
if (late > 0) {
  const from = Math.min(words[late - 1].endMs, endMs - 300);
  const step = (endMs - from) / (words.length - late);
  words.slice(late).forEach((w, k) => {
    w.startMs = Math.round(from + k * step);
    w.endMs = Math.round(from + (k + 1) * step);
  });
}

// 1. Silences, measured from the audio (more exact than Whisper's word edges)
const sd = ff('ffmpeg', ['-hide_banner', '-nostats', '-i', clip, '-vn', '-af', `silencedetect=n=${NOISE_DB}dB:d=${GAP}`, '-c:a', 'pcm_s16le', '-f', 'null', '-']); // audio only: the bundled ffmpeg has no null video encoder
const silences = [];
for (const line of sd.stderr.split('\n')) {
  const s = line.match(/silence_start: ([\d.]+)/);
  const e = line.match(/silence_end: ([\d.]+)/);
  if (s) silences.push({ from: Number(s[1]), to: total });
  if (e && silences.length) silences[silences.length - 1].to = Number(e[1]);
}

// 2. Speech = the clip minus silences, each kept part padded a little
let keep = [];
let cursor = 0;
for (const s of silences) {
  if (s.from > cursor) keep.push({ from: cursor, to: s.from });
  cursor = s.to;
}
if (cursor < total) keep.push({ from: cursor, to: total });
keep = keep.map((k) => ({ from: Math.max(0, k.from - PAD), to: Math.min(total, k.to + PAD) }));

// 3. Remove dropped words (their time span), then merge parts that now touch
for (const i of DROP) {
  const w = words[i];
  if (!w) continue;
  const a = w.startMs / 1000, b = w.endMs / 1000;
  keep = keep.flatMap((k) => (b <= k.from || a >= k.to ? [k] : [
    ...(a > k.from ? [{ from: k.from, to: a }] : []),
    ...(b < k.to ? [{ from: b, to: k.to }] : []),
  ]));
}
keep.sort((x, y) => x.from - y.from);
const merged = [];
for (const k of keep) {
  const last = merged[merged.length - 1];
  if (last && k.from <= last.to) last.to = Math.max(last.to, k.to);
  else merged.push({ ...k });
}

// 4. Whole frames, so the video and the captions can never drift apart
let out = 0;
const segments = merged
  .map((k) => ({ fromFrame: Math.round(k.from * FPS), toFrame: Math.round(k.to * FPS) }))
  .filter((s) => s.toFrame - s.fromFrame >= 2)
  .map((s) => {
    const seg = { ...s, startFrame: out };
    out += s.toFrame - s.fromFrame;
    return seg;
  });

// 5. Captions moved onto the new timeline; words inside a cut are dropped
const toOut = (ms) => {
  const f = (ms / 1000) * FPS;
  const seg = segments.find((s) => f >= s.fromFrame && f < s.toFrame);
  return seg ? { seg, frame: seg.startFrame + (f - seg.fromFrame) } : null;
};
// Whisper often starts a word inside the pause before it: snap it to where speech resumes.
const snapIntoSpeech = (w) => {
  const a = (w.startMs / 1000) * FPS, b = (w.endMs / 1000) * FPS;
  const next = segments.find((s) => s.fromFrame > a && s.fromFrame < b);
  return next ? (next.fromFrame / FPS) * 1000 : w.startMs;
};
const captions = words.flatMap((w, i) => {
  if (DROP.has(i)) return [];
  const startMs = toOut(w.startMs) ? w.startMs : snapIntoSpeech(w);
  const start = toOut(startMs);
  if (!start) return [];
  const endFrame = Math.min(start.seg.startFrame + (start.seg.toFrame - start.seg.fromFrame), start.frame + ((w.endMs - startMs) / 1000) * FPS);
  return [{ ...w, i, startMs: Math.round((start.frame / FPS) * 1000), endMs: Math.round((endFrame / FPS) * 1000), timestampMs: null }];
});

writeFileSync(join(PUBLIC, 'edit.json'), JSON.stringify({ fps: FPS, durationInFrames: out, segments, captions }, null, 1));
const cutSec = total - out / FPS;
console.log(`OK ${segments.length} segments, ${total.toFixed(2)}s -> ${(out / FPS).toFixed(2)}s (cut ${cutSec.toFixed(2)}s), ${captions.length}/${words.length} words kept`);
