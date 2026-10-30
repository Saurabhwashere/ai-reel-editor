// Prints every kept word with its number and reel time, so scene.json can point at words: { "word": 12 }.
//
//   node scripts/words.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FPS, PUBLIC } from './lib.mjs';

const edit = JSON.parse(readFileSync(join(PUBLIC, 'edit.json'), 'utf8'));
const rows = edit.captions.map((c) => {
  const f = Math.round((c.startMs / 1000) * FPS);
  return `${String(c.i).padStart(4)}  ${(c.startMs / 1000).toFixed(2).padStart(6)}s  f${String(f).padEnd(5)} ${c.text.trim()}`;
});
console.log(' word    time   frame  text');
console.log(rows.join('\n'));
console.log(`Reel: ${edit.durationInFrames} frames (${(edit.durationInFrames / FPS).toFixed(2)}s)`);
