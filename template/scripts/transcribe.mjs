// Word-level transcript of public/clip.mp4 -> public/captions.json (times in the original clip).
//
//   node scripts/transcribe.mjs ["names and keywords, e.g. Claude, Claude Code, Remotion"]
//
// The keywords go to Whisper as a prompt, so it spells them right more often. Still read captions.json after.
// First run installs whisper.cpp and downloads the model into ~/ai-reel-editor (once).
import { downloadWhisperModel, installWhisperCpp, toCaptions, transcribe } from '@remotion/install-whisper-cpp';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MODELS_DIR, PUBLIC, WHISPER_DIR, ff } from './lib.mjs';

const WHISPER_VERSION = '1.5.5'; // Remotion's recommended release; Windows gets a ready-made build
const MODEL = process.env.WHISPER_MODEL || 'medium.en'; // 1.5 GB once; 'small.en' (0.5 GB) is faster, misses more names
const keywords = process.argv[2] || 'Claude, Claude Code';

const clip = join(PUBLIC, 'clip.mp4');
if (!existsSync(clip)) throw new Error(`No clip at ${clip}`);
mkdirSync(MODELS_DIR, { recursive: true });

await installWhisperCpp({ to: WHISPER_DIR, version: WHISPER_VERSION, printOutput: false });
await downloadWhisperModel({ model: MODEL, folder: MODELS_DIR, printOutput: false });

// Whisper needs 16 kHz mono WAV
const wav = join(MODELS_DIR, 'input.wav');
ff('ffmpeg', ['-loglevel', 'error', '-y', '-i', clip, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav]);

console.log(`Transcribing with ${MODEL}...`);
const output = await transcribe({
  inputPath: wav,
  whisperPath: WHISPER_DIR,
  whisperCppVersion: WHISPER_VERSION,
  model: MODEL,
  modelFolder: MODELS_DIR,
  tokenLevelTimestamps: true,
  language: 'en',
  splitOnWord: true,
  printOutput: false,
  additionalArgs: [['--prompt', keywords]],
});
rmSync(wav, { force: true });

const { captions } = toCaptions({ whisperCppOutput: output });
// Whisper sometimes returns punctuation as its own word: keep only words with a letter or digit
const words = captions.filter((c) => /[\p{L}\p{N}]/u.test(c.text));
writeFileSync(join(PUBLIC, 'captions.json'), JSON.stringify(words, null, 1));
console.log(`OK ${words.length} words -> public/captions.json`);
console.log(words.map((w) => w.text.trim()).join(' '));
