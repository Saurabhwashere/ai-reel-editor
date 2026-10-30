// Shared helpers for the project scripts. Run every script from the project folder.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

export const WIN = platform() === 'win32';
// Two places:
//   DESK   = Desktop/ai-reel-editor: what the user touches (raw clips in, finished reels out)
//   ENGINE = ~/.ai-reel-editor (hidden): Remotion project + Whisper, about 2 GB, kept off the Desktop and out of iCloud
// Windows often moves the Desktop into OneDrive; use that one when it exists.
const desktop = () => {
  const oneDrive = join(homedir(), 'OneDrive', 'Desktop');
  return WIN && existsSync(oneDrive) ? oneDrive : join(homedir(), 'Desktop');
};
export const DESK = join(desktop(), 'ai-reel-editor');
export const RAW = join(DESK, 'raw');
export const EXPORTS = join(DESK, 'exports');
export const ENGINE = join(homedir(), '.ai-reel-editor');
export const PROJECT = join(ENGINE, 'project');
// Outside project/ so a template update never deletes them. whisper.cpp skips installing if its folder exists,
// so nothing else may live in WHISPER_DIR.
export const WHISPER_DIR = join(ENGINE, 'whisper.cpp');
export const MODELS_DIR = join(ENGINE, 'whisper-models');
export const PUBLIC = join(process.cwd(), 'public');
export const FPS = 30;

// Runs Remotion's CLI through Node with no shell, so a file name like "a&b.mp4" can never run as a command on Windows
export const remotion = (args, options = {}) => spawnSync(process.execPath, [join(process.cwd(), 'node_modules', '@remotion', 'cli', 'remotion-cli.js'), ...args], options);

// Remotion's bundled ffmpeg / ffprobe, so the user never installs ffmpeg
export function ff(tool, args) {
  const r = remotion([tool, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${tool} failed: ${(r.stderr || '').trim().split('\n').slice(-3).join(' | ')}`);
  return r;
}

export function durationSeconds(file) {
  const r = ff('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return Number(r.stdout.trim());
}

// Where the sound stops. Can be earlier than the video; a gap past it would play as silence.
export function audioSeconds(file) {
  const r = ff('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=duration', '-of', 'csv=p=0', file]);
  const s = Number(r.stdout.trim());
  return Number.isFinite(s) && s > 0 ? s : durationSeconds(file);
}
