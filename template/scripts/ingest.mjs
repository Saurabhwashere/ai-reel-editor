// Brings a raw clip into the project as public/clip.mp4 and clears the last edit.
// iPhone .mov / HEVC and variable frame rate clips are converted to H.264, 30 fps constant:
// Remotion shows one-frame flashes on .mov, and cuts drift on variable frame rate.
//
//   node scripts/ingest.mjs [path/to/clip]                     default: the newest video in Desktop/ai-reel-editor/raw/
//   node scripts/ingest.mjs --all                              every video in raw/, in name order, joined into one clip
//   node scripts/ingest.mjs <file> --to screens/demo.mp4       a screen recording (also converted, sound removed)
//   node scripts/ingest.mjs <file> --to music/bed.mp3          music: copied as is
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { FPS, MODELS_DIR, PUBLIC, RAW, durationSeconds, ff } from './lib.mjs';

const VIDEO = new Set(['.mp4', '.mov', '.m4v', '.mkv', '.webm']);
const raw = RAW;

// Several clips: each is converted to the same format, then joined without another re-encode.
// public/clips.json records where each one starts, so Claude can tell takes apart.
if (process.argv.includes('--all')) {
  const vids = readdirSync(raw).filter((f) => VIDEO.has(extname(f).toLowerCase())).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!vids.length) {
    console.log(`NO CLIP: drop videos into ${raw}`);
    process.exit(1);
  }
  mkdirSync(MODELS_DIR, { recursive: true });
  for (const f of ['clip.mp4', 'captions.json', 'edit.json', 'scene.json', 'clips.json']) rmSync(join(PUBLIC, f), { force: true });
  const parts = [];
  const clips = [];
  let at = 0;
  for (const [i, f] of vids.entries()) {
    const part = join(MODELS_DIR, `part-${i}.mp4`);
    console.log(`Converting ${i + 1}/${vids.length}: ${f}`);
    // 1080x1920 filled edge to edge, so clips filmed differently still join
    ff('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(raw, f), '-r', String(FPS), '-fps_mode', 'cfr',
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', part]);
    parts.push(part);
    clips.push({ file: f, startSeconds: Number(at.toFixed(3)) });
    at += durationSeconds(part);
  }
  const list = join(MODELS_DIR, 'parts.txt');
  writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
  ff('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', join(PUBLIC, 'clip.mp4')]);
  writeFileSync(join(PUBLIC, 'clips.json'), JSON.stringify(clips, null, 1));
  [...parts, list].forEach((p) => rmSync(p, { force: true }));
  console.log(`OK joined ${vids.length} clips -> public/clip.mp4 (${at.toFixed(1)}s)`);
  process.exit(0);
}

const toIdx = process.argv.indexOf('--to');
const TO = toIdx > -1 ? process.argv[toIdx + 1] : null;
let src = process.argv[2] && process.argv[2] !== '--to' ? process.argv[2] : null;
if (TO && !src) throw new Error('Give the file to bring in: node scripts/ingest.mjs <file> --to ' + TO);

// Music, images, sound effects: copy as is into public/<folder>/
if (TO && !TO.startsWith('screens/')) {
  mkdirSync(dirname(join(PUBLIC, TO)), { recursive: true });
  copyFileSync(src, join(PUBLIC, TO));
  console.log(`OK copied ${src} -> public/${TO}`);
  process.exit(0);
}

if (!src) {
  const vids = existsSync(raw) ? readdirSync(raw).filter((f) => VIDEO.has(extname(f).toLowerCase())) : [];
  if (!vids.length) {
    console.log(`NO CLIP: drop a video into ${raw}`);
    process.exit(1);
  }
  // newest = most recently added: a copied file keeps its old modified date, but its change time (ctime) is new
  const added = (f) => { const s = statSync(join(raw, f)); return Math.max(s.mtimeMs, s.ctimeMs); };
  src = join(raw, vids.sort((a, b) => added(b) - added(a))[0]);
}

const probe = JSON.parse(ff('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', src]).stdout);
const v = probe.streams.find((s) => s.codec_type === 'video');
const a = probe.streams.find((s) => s.codec_type === 'audio');
if (!v) throw new Error(`${src} has no video`);
if (!a && !TO) console.log('WARNING: this clip has no sound, so nothing can be transcribed or cut.');

const rate = (r) => { const [n, d] = String(r).split('/').map(Number); return d ? n / d : 0; };
const ready = extname(src).toLowerCase() === '.mp4' && v.codec_name === 'h264' && v.pix_fmt === 'yuv420p'
  && Math.abs(rate(v.avg_frame_rate) - FPS) < 0.01 && Math.abs(rate(v.r_frame_rate) - FPS) < 0.01
  && (!a || a.codec_name === 'aac');

const out = join(PUBLIC, TO ?? 'clip.mp4');
mkdirSync(dirname(out), { recursive: true });
// a new talking clip starts a new edit; a screen recording joins the current one
if (!TO) for (const f of ['clip.mp4', 'captions.json', 'edit.json', 'scene.json']) rmSync(join(PUBLIC, f), { force: true });

// Voice evened out to Instagram's loudness (-14 LUFS, peaks under -1.5 dB), so every reel plays at the same level
const LOUDNESS = ['-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000'];

if (ready && !TO) {
  ff('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-c:v', 'copy', ...(a ? LOUDNESS : []), '-movflags', '+faststart', out]);
  console.log(`OK ${src} -> public/clip.mp4 (video already H.264 ${FPS} fps; loudness evened out)`);
} else {
  console.log(`Converting ${v.codec_name} ${rate(v.avg_frame_rate).toFixed(2)} fps -> H.264 ${FPS} fps (phone rotation is applied)...`);
  ff('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-r', String(FPS), '-fps_mode', 'cfr',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    ...(TO || !a ? ['-an'] : LOUDNESS), '-movflags', '+faststart', out]);
  console.log(`OK converted ${src} -> public/${TO ?? 'clip.mp4'}`);
}
