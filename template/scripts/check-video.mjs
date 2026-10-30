// Checks a render before anyone watches it: frame count, one-frame flashes, black frames, frozen stretches.
//
//   node scripts/check-video.mjs exports/<name>.mp4
//
// Works on tiny grey frames, so a 60-second reel takes seconds. Exits 1 if anything needs fixing.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FPS, PUBLIC, ff } from './lib.mjs';

const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/check-video.mjs <render.mp4>');

const W = 32, H = 56;
const FLASH = 14; // brightness jump (0-255, average per pixel) that counts as a big change
const FREEZE_FRAMES = 45; // 1.5 s without a single changed pixel

let bad = 0;
const report = (ok, msg) => { if (!ok) bad++; console.log(`${ok ? 'OK' : 'FIX'} ${msg}`); };

// 1. Frame count against the edit
const probe = ff('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=nb_read_frames,width,height', '-of', 'csv=p=0', file]).stdout.trim().split(',');
const [width, height, frames] = probe.map(Number);
const editPath = join(PUBLIC, 'edit.json');
const want = existsSync(editPath) ? JSON.parse(readFileSync(editPath, 'utf8')).durationInFrames : null;
report(width === 1080 && height === 1920, `size ${width}x${height}`);
if (want === null) console.log(`INFO ${frames} frames (no edit.json to compare)`);
else report(frames === want, `frames ${frames} (edit says ${want})`);

// 2. Tiny grey frames: the bundled ffmpeg can only write them one file each
const dir = mkdtempSync(join(tmpdir(), 'reel-check-'));
try {
  ff('ffmpeg', ['-loglevel', 'error', '-y', '-i', file, '-vf', `scale=${W}:${H},format=gray`, '-c:v', 'rawvideo', '-f', 'image2', join(dir, '%06d.raw')]);
  const imgs = readdirSync(dir).sort().map((f) => readFileSync(join(dir, f)));
  const diff = (a, b) => {
    let t = 0;
    for (let i = 0; i < a.length; i++) t += Math.abs(a[i] - b[i]);
    return t / a.length;
  };
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const time = (i) => `${(i / FPS).toFixed(2)}s (frame ${i})`;

  // A flash: frame i differs from both neighbours, which match each other. A hard cut changes once and stays.
  const flashes = [];
  for (let i = 1; i + 1 < imgs.length; i++) {
    const into = diff(imgs[i - 1], imgs[i]), out = diff(imgs[i], imgs[i + 1]);
    // relative to the jump itself: a moving person still changes a little between the two neighbours
    if (into > FLASH && out > FLASH && diff(imgs[i - 1], imgs[i + 1]) < Math.min(into, out) / 2) flashes.push(i);
  }
  report(!flashes.length, `one-frame flashes: ${flashes.length}${flashes.length ? ` at ${flashes.slice(0, 5).map(time).join(', ')}` : ''}`);

  const black = imgs.flatMap((im, i) => (mean(im) < 6 ? [i] : []));
  report(!black.length, `black frames: ${black.length}${black.length ? ` from ${time(black[0])}` : ''}`);

  let run = 0, frozen = null;
  for (let i = 1; i < imgs.length; i++) {
    run = diff(imgs[i - 1], imgs[i]) < 0.02 ? run + 1 : 0;
    if (run >= FREEZE_FRAMES && frozen === null) frozen = i - run;
  }
  report(frozen === null, `frozen stretches over 1.5 s: ${frozen === null ? 0 : `from ${time(frozen)}`}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(bad ? 1 : 0);
