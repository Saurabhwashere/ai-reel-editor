// Last step on a render: evens out the final mix (voice + music + sound effects) to -14 LUFS with peaks
// under -1 dB, so sound effects can never clip on a phone. The video is copied, not re-encoded.
//
//   node scripts/finish.mjs exports/<name>.mp4        -> exports/<name>-final.mp4
import { existsSync } from 'node:fs';
import { ff } from './lib.mjs';

const src = process.argv[2];
if (!src || !existsSync(src)) throw new Error('Usage: node scripts/finish.mjs exports/<name>.mp4');
const out = src.replace(/\.mp4$/i, '-final.mp4');

// Two passes: measure first, then apply exactly (linear), which keeps the voice's dynamics
const TARGET = 'I=-14:TP=-2:LRA=11'; // -2, not -1: AAC encoding adds a little overshoot on sharp hits
const m = ff('ffmpeg', ['-hide_banner', '-nostats', '-i', src, '-vn', '-af', `loudnorm=${TARGET}:print_format=json`, '-c:a', 'pcm_s16le', '-f', 'null', '-']);
const j = JSON.parse(m.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/)[0]);
const second = `loudnorm=${TARGET}:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;

const encode = (filter) => ff('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-c:v', 'copy', '-af', filter, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', out]);
const peakOf = (file) => Number(JSON.parse(ff('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'loudnorm=print_format=json', '-c:a', 'pcm_s16le', '-f', 'null', '-']).stderr.match(/\{[^{}]*"input_i"[^{}]*\}/)[0]).input_tp);

encode(second);
// Sharp sound effects can still poke above the limit in the gentle (linear) pass: then cap peaks dynamically
if (peakOf(out) > -1) encode(`loudnorm=${TARGET}`);
console.log(`OK ${out} (peak ${peakOf(out).toFixed(1)} dBTP)`);
