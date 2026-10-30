#!/usr/bin/env node
// First-run setup and health check for /ai-reel-editor. Runs on macOS and Windows.
// Prints one STATUS line per check, then READY or NOT READY. Safe to run again: it only fills in what is missing.
//
//   node setup.mjs            check + create the workspace + install the Remotion project
//   node setup.mjs --check    check only, change nothing

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, writeFileSync, readFileSync, symlinkSync } from 'node:fs';
import { platform, arch } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SKILL = dirname(dirname(fileURLToPath(import.meta.url)));
// Same paths the project scripts use (plain Node, no packages needed)
const { DESK, ENGINE, EXPORTS, PROJECT } = await import(pathToFileURL(join(SKILL, 'template', 'scripts', 'lib.mjs')).href);
const CHECK_ONLY = process.argv.includes('--check');
const MIN_NODE = 18;
const OS = { darwin: 'macos', win32: 'windows' }[platform()] ?? 'linux';
const WIN = OS === 'windows';
const NPM = WIN ? 'npm.cmd' : 'npm';
const NPX = WIN ? 'npx.cmd' : 'npx';

const FIX = {
  node: { macos: 'brew install node', windows: 'winget install --id OpenJS.NodeJS.LTS -e   (then quit and reopen Claude)', linux: 'install Node 22 LTS from https://nodejs.org' },
};

let ok = true;
const say = (msg) => console.log(msg);
const fail = (msg) => { ok = false; say(msg); };

function run(cmd, args, opts = {}) {
  // shell: true on Windows so .cmd shims resolve; args here never contain user input
  return spawnSync(cmd, args, { encoding: 'utf8', shell: WIN, ...opts });
}

// 1. Node
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor >= MIN_NODE) say(`STATUS node OK (${process.versions.node})`);
else fail(`STATUS node TOO OLD (${process.versions.node}, need ${MIN_NODE}+) -> ${FIX.node[OS]}`);

// 2. npm
const npm = run(NPM, ['-v']);
if (npm.status === 0) say(`STATUS npm OK (${npm.stdout.trim()})`);
else fail(`STATUS npm MISSING -> reinstall Node: ${FIX.node[OS]}`);

// 2b. Mac: Whisper is built from source on first transcribe (git + make), which needs Xcode Command Line Tools
if (OS === 'macos') {
  if (run('xcode-select', ['-p']).status === 0) say('STATUS build tools OK (Xcode Command Line Tools)');
  else fail('STATUS build tools MISSING -> xcode-select --install   (click Install in the dialog, then run setup again)');
}

// 3. Desktop folder (raw clips in, reels out) and the hidden engine folder
const folders = ['raw', 'references', 'exports'].map((f) => join(DESK, f));
if (CHECK_ONLY) {
  say(`STATUS desktop folder ${folders.every(existsSync) ? 'OK' : 'MISSING'} (${DESK})`);
} else {
  folders.forEach((f) => mkdirSync(f, { recursive: true }));
  mkdirSync(ENGINE, { recursive: true });
  say(`STATUS desktop folder OK (${DESK})`);
}

// 4. Remotion project (copied from the skill's template, then npm install)
const installed = existsSync(join(PROJECT, 'node_modules', 'remotion'));
const templateVersion = JSON.parse(readFileSync(join(SKILL, 'template', 'package.json'), 'utf8')).version;
const projectPkg = join(PROJECT, 'package.json');
const projectVersion = existsSync(projectPkg) ? JSON.parse(readFileSync(projectPkg, 'utf8')).version : null;

if (installed && projectVersion === templateVersion) {
  say(`STATUS remotion project OK (${PROJECT})`);
} else if (CHECK_ONLY) {
  fail(`STATUS remotion project MISSING or outdated -> run: node "${join(SKILL, 'scripts', 'setup.mjs')}"`);
} else if (ok) {
  say(`STATUS remotion project: installing into ${PROJECT} (first time downloads about 1 GB, a few minutes)`);
  // Copy code only; never overwrite the user's clips in public/
  cpSync(join(SKILL, 'template'), PROJECT, { recursive: true, filter: (src) => !src.includes('node_modules') });
  const r = run(NPM, ['install', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: PROJECT, stdio: 'inherit' });
  if (r.status === 0) say('STATUS remotion project OK');
  else fail('STATUS remotion project FAILED (npm output above). Check the internet connection and run setup again.');
}

// 4b. project/exports points at the Desktop exports folder, so renders land where the user looks
//     (a junction on Windows: no admin rights needed)
if (!CHECK_ONLY && existsSync(PROJECT) && !existsSync(join(PROJECT, 'exports'))) {
  symlinkSync(EXPORTS, join(PROJECT, 'exports'), WIN ? 'junction' : 'dir');
}
if (existsSync(PROJECT)) {
  if (existsSync(join(PROJECT, 'exports'))) say('STATUS exports link OK');
  else fail(`STATUS exports link MISSING -> run: node "${join(SKILL, 'scripts', 'setup.mjs')}"`);
}

// 5. ffmpeg: Remotion ships its own copy, so the user installs nothing
if (existsSync(join(PROJECT, 'node_modules', 'remotion'))) {
  const ff = run(NPX, ['remotion', 'ffmpeg', '-version'], { cwd: PROJECT });
  const line = (ff.stdout || '').split('\n')[0];
  if (ff.status === 0 && line.startsWith('ffmpeg')) say(`STATUS ffmpeg OK (bundled with Remotion: ${line.split(' ').slice(0, 3).join(' ')})`);
  else fail('STATUS ffmpeg FAILED (Remotion\'s bundled ffmpeg did not run). Run setup again; if it repeats, reinstall Node.');
}

// 6. Record this machine so SKILL.md never guesses commands
if (!CHECK_ONLY && ok) {
  writeFileSync(join(ENGINE, '.machine.json'), JSON.stringify({
    os: OS, arch: arch(), node: process.versions.node, desktopFolder: DESK, project: PROJECT,
    ffmpeg: `${NPX} remotion ffmpeg`, ffprobe: `${NPX} remotion ffprobe`, checkedAt: new Date().toISOString(),
  }, null, 2));
}

say(ok ? 'READY' : 'NOT READY');
process.exit(ok ? 0 : 1);
