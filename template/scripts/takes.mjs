// Finds repeated takes: lines said more than once across the clip(s), so the best one can be kept.
//
//   node scripts/takes.mjs
//
// Prints each group with its word numbers. Usually keep the LAST take (people improve), then:
//   node scripts/cut.mjs --drop "12-20,45-53"
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLIC } from './lib.mjs';

const words = JSON.parse(readFileSync(join(PUBLIC, 'captions.json'), 'utf8'));
const clipsPath = join(PUBLIC, 'clips.json');
const clips = existsSync(clipsPath) ? JSON.parse(readFileSync(clipsPath, 'utf8')) : [];
const clipAt = (ms) => [...clips].reverse().find((c) => ms / 1000 >= c.startSeconds)?.file ?? '';

// Lines end at punctuation or a pause over 0.6 s
const lines = [];
let cur = [];
words.forEach((w, i) => {
  cur.push(i);
  const next = words[i + 1];
  if (!next || /[.?!]$/.test(w.text.trim()) || next.startMs - w.endMs > 600) {
    lines.push(cur);
    cur = [];
  }
});

const clean = (w) => w.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const bag = (l) => l.map((i) => clean(words[i]));
// Share of the shorter line's words found in the longer one
const overlap = (a, b) => {
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  const rest = [...l];
  let hit = 0;
  for (const w of s) {
    const k = rest.indexOf(w);
    if (k > -1) { hit++; rest.splice(k, 1); }
  }
  return hit / s.length;
};

const used = new Set();
let groups = 0;
lines.forEach((a, i) => {
  if (used.has(i) || a.length < 3) return;
  const same = lines.flatMap((b, j) => (j > i && !used.has(j) && b.length >= 3 && overlap(bag(a), bag(b)) >= 0.7 ? [j] : []));
  if (!same.length) return;
  groups++;
  console.log(`\nLine said ${same.length + 1} times:`);
  [i, ...same].forEach((j) => {
    used.add(j);
    const l = lines[j];
    const from = (words[l[0]].startMs / 1000).toFixed(1);
    const clip = clipAt(words[l[0]].startMs);
    console.log(`  words ${l[0]}-${l[l.length - 1]}  ${from}s${clip ? ` (${clip})` : ''}: ${l.map((k) => words[k].text.trim()).join(' ')}`);
  });
});
console.log(groups ? `\n${groups} repeated line(s). Pick the best take of each and drop the others with cut.mjs --drop.` : 'No repeated lines found.');
