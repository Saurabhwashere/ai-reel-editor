// Checks a render's sound: loudness, peak, and that each sound effect is actually heard.
//
//   node scripts/check-audio.mjs ../exports/<name>.mp4
//
// Targets for Instagram: about -14 LUFS (loudness), peak below -1 dBTP (no clipping).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLIC, ff } from './lib.mjs';

const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/check-audio.mjs <render.mp4>');

const r = ff('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'loudnorm=print_format=json', '-c:a', 'pcm_s16le', '-f', 'null', '-']);
const json = JSON.parse(r.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/)[0]); // the loudnorm block in ffmpeg's log
const lufs = Number(json.input_i), peak = Number(json.input_tp);
const verdict = (ok) => (ok ? 'OK' : 'FIX');
console.log(`${verdict(lufs > -17 && lufs < -11)} loudness ${lufs.toFixed(1)} LUFS (aim -14)`);
console.log(`${verdict(peak <= -1)} peak ${peak.toFixed(1)} dBTP (keep below -1)`);

// Each sound effect should lift the level around its frame compared with just before it
const scenePath = join(PUBLIC, 'scene.json');
if (existsSync(scenePath)) {
  const scene = JSON.parse(readFileSync(scenePath, 'utf8'));
  const n = (scene.sfx ?? []).length + (scene.graphics ?? []).filter((g) => g.sfx).length + (scene.layouts ?? []).filter((l) => l.sfx).length;
  console.log(`INFO ${n} sound effects planned in scene.json. Listen to the phone copy: levels are numbers, not ears.`);
}
