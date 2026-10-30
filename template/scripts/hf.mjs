// Optional HyperFrames bridge: makes one transparent effect there, for the moments Remotion can't do alone.
// Remotion stays the editor; HyperFrames only supplies a .webm that sits in the reel like any graphic.
// Needs Node 22+ and its own ffmpeg (Remotion's bundled copy is not enough here). The first use downloads
// HyperFrames and a browser (a few hundred MB).
//
//   node scripts/hf.mjs new <name>        creates hyperframes/<name>/ (1080x1920) to edit
//   node scripts/hf.mjs render <name>     -> public/hyperframes/<name>.webm, with transparency
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { FPS, PUBLIC, WIN } from './lib.mjs';

const [cmd, name] = process.argv.slice(2);
if (!['new', 'render'].includes(cmd) || !name) throw new Error('Usage: node scripts/hf.mjs new|render <name>');
if (Number(process.versions.node.split('.')[0]) < 22) throw new Error(`HyperFrames needs Node 22+, this is ${process.versions.node}`);

// Homebrew first: an old ffmpeg elsewhere on PATH (Anaconda ships 4.3) fails with "Unrecognized option 'deadline'"
const PATH = WIN ? process.env.PATH : `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}`;
const ffv = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', shell: WIN, env: { ...process.env, PATH } });
const major = Number(/ffmpeg version n?(\d+)/.exec(ffv.stdout ?? '')?.[1] ?? 0);
if (major < 5 && !/version N-/.test(ffv.stdout ?? '')) {
  throw new Error(`HyperFrames needs ffmpeg 5+ (found ${major || 'none'}). Install it: ${WIN ? 'winget install --id Gyan.FFmpeg -e, then reopen Claude' : 'brew install ffmpeg'}`);
}

const root = join(process.cwd(), 'hyperframes');
const dir = join(root, name);
const hf = (args, cwd) => {
  const r = spawnSync(WIN ? 'npx.cmd' : 'npx', ['--yes', 'hyperframes@0.8.221', ...args], { cwd, stdio: 'inherit', shell: WIN, env: { ...process.env, PATH, HYPERFRAMES_SKIP_SKILLS: '1' } });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (cmd === 'new') {
  mkdirSync(root, { recursive: true });
  hf(['init', name, '--example', 'blank', '--resolution', 'portrait', '--non-interactive', '--skip-skills'], root);
  console.log(`OK hyperframes/${name}/index.html. Keep the page background transparent, then: node scripts/hf.mjs render ${name}`);
} else {
  if (!existsSync(dir)) throw new Error(`No hyperframes/${name}: run "new" first`);
  mkdirSync(join(PUBLIC, 'hyperframes'), { recursive: true });
  const out = join(PUBLIC, 'hyperframes', `${name}.webm`);
  hf(['render', '--format', 'webm', '--fps', String(FPS), '--quality', 'looks', '--output', out], dir);
  console.log(`OK public/hyperframes/${name}.webm. Use it: { "kind": "hyperframe", "src": "hyperframes/${name}.webm", "at": ..., "until": ... }`);
}
