// Cuts the speaker out of the frames behind every "behind" graphic in scene.json, so text can sit behind the head.
// Runs a small person-segmentation model inside Remotion's own browser: no Python, no extra programs.
//
//   node scripts/cutout.mjs
//
// Output: public/cutouts/<graphic number>/<reel frame>.png. About 1 second per 3 frames. Re-run after any re-cut.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FPS, PUBLIC, WIN, ff } from './lib.mjs';

const edit = JSON.parse(readFileSync(join(PUBLIC, 'edit.json'), 'utf8'));
const scene = JSON.parse(readFileSync(join(PUBLIC, 'scene.json'), 'utf8'));
const frameOf = (at, fallback) => {
  if (at === undefined) return fallback;
  if (typeof at === 'number') return at;
  const w = edit.captions.find((c) => c.i === at.word);
  return w ? Math.round((w.startMs / 1000) * FPS) + (at.offset ?? 0) : fallback;
};

// The model's browser code ships in node_modules; Remotion serves it from public/
const wasm = join(PUBLIC, 'mediapipe', 'wasm');
if (!existsSync(wasm)) cpSync(join('node_modules', '@mediapipe', 'tasks-vision', 'wasm'), wasm, { recursive: true });

const npx = WIN ? 'npx.cmd' : 'npx';
const srcDir = join(PUBLIC, 'cutouts', '_src');

for (const [i, g] of (scene.graphics ?? []).entries()) {
  if (g.kind !== 'behind') continue;
  const from = frameOf(g.at, -1);
  const to = frameOf(g.until, from + FPS * 2);
  if (from < 0) continue;
  const out = join(PUBLIC, 'cutouts', String(i));
  rmSync(out, { recursive: true, force: true });
  rmSync(srcDir, { recursive: true, force: true });
  mkdirSync(srcDir, { recursive: true });

  // Same crop as the speaker in the reel (cover, 30% from the top), named by reel frame
  for (const s of edit.segments) {
    const a = Math.max(from, s.startFrame);
    const b = Math.min(to, s.startFrame + s.toFrame - s.fromFrame);
    if (b <= a) continue;
    const t = (s.fromFrame + a - s.startFrame) / FPS;
    ff('ffmpeg', ['-loglevel', 'error', '-y', '-ss', t.toFixed(4), '-i', join(PUBLIC, 'clip.mp4'), '-frames:v', String(b - a),
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920:(in_w-1080)/2:(in_h-1920)*0.3',
      '-q:v', '2', '-start_number', String(a), join(srcDir, '%d.jpg')]);
  }

  const count = to - from;
  console.log(`Cutting out ${count} frames for "${g.text}"...`);
  const props = join(process.cwd(), 'cutout-props.json');
  writeFileSync(props, JSON.stringify({ from, count }));
  const r = spawnSync(npx, ['remotion', 'render', 'Cutout', out, '--sequence', '--image-format=png', `--props=${props}`, '--concurrency=2', '--log=error'], { stdio: 'inherit', shell: WIN });
  rmSync(props, { force: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
  // element-012.png -> <reel frame>.png
  for (const f of readdirSync(out)) {
    const n = Number(/(\d+)\.png$/.exec(f)?.[1]);
    renameSync(join(out, f), join(out, `${from + n}.png`));
  }
  console.log(`OK public/cutouts/${i}`);
}
rmSync(srcDir, { recursive: true, force: true });
