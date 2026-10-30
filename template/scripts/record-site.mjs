// Records a website by itself, so the user never has to screen-record. Scrolling is perfectly smooth because every
// frame is placed and captured on purpose, not filmed live. Uses the browser Remotion already downloaded.
//
//   node scripts/record-site.mjs <url> --name demo [--steps steps.json] [--width 1200] [--height 1000]
//
// Without --steps: pauses, scrolls smoothly down 2 screens, pauses. steps.json is a list, run in order:
//   { "hold": 1 }                               stay still for 1 second
//   { "scroll": 1.5, "seconds": 3 }             scroll down 1.5 screens over 3 seconds (negative = up)
//   { "scrollTo": "text=Pricing", "seconds": 2 } scroll until that element is near the top
//   { "move": "text=Get started", "seconds": 1 } glide the pointer to an element
//   { "click": "text=Pricing", "hold": 1.5 }    glide there and click, then stay on the result
//
// Output: public/screens/<name>.mp4 and public/screens/<name>.json (ready-made "cursor" and "camera" for scene.json).
// Public pages only: never sign in, submit a form, buy, or post anything.
import { ensureBrowser } from '@remotion/renderer';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { FPS, PUBLIC, ff } from './lib.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const url = process.argv[2];
const name = arg('name', 'site');
const W = Number(arg('width', 1200));
const H = Number(arg('height', 1000));
if (!url || !/^https?:\/\//.test(url)) throw new Error('Usage: node scripts/record-site.mjs https://... --name demo');
const steps = arg('steps') ? JSON.parse(readFileSync(arg('steps'), 'utf8')) : [{ hold: 1 }, { scroll: 2, seconds: 5 }, { hold: 1 }];

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const frames = mkdtempSync(join(tmpdir(), 'reel-record-'));
const browserPath = (await ensureBrowser()).path;
const browser = await chromium.launch({ executablePath: browserPath, headless: true });
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })).newPage();

let n = 0;
let pointer = { x: 0.5, y: 0.75 };
const cursor = [{ at: 0, ...pointer }];
const camera = [{ at: 0, x: 0.5, y: 0.5, zoom: 1 }];
const shot = async () => {
  n++;
  await page.screenshot({ path: join(frames, `${String(n).padStart(6, '0')}.jpg`), type: 'jpeg', quality: 92 });
};
const hold = async (seconds) => { for (let i = 0; i < Math.round(seconds * FPS); i++) await shot(); };
const scrollY = () => page.evaluate(() => window.scrollY);
const scrollBy = async (px, seconds) => {
  const from = await scrollY();
  const count = Math.max(1, Math.round(seconds * FPS));
  for (let i = 1; i <= count; i++) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), from + px * ease(i / count));
    await shot();
  }
};
// Where an element is, as 0..1 of the screen. Scrolls it into view first if needed.
const locate = async (selector) => {
  const el = page.locator(selector).filter({ visible: true }).first();
  await el.waitFor({ state: 'visible', timeout: 5000 });
  const box = await el.boundingBox();
  return { el, box, x: (box.x + box.width / 2) / W, y: (box.y + box.height / 2) / H };
};
const glide = async (to, seconds) => {
  const at = n;
  cursor.push({ at, ...pointer }, { at: at + Math.round(seconds * FPS), x: to.x, y: to.y });
  pointer = { x: to.x, y: to.y };
  await hold(seconds);
};

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500); // let hero images and fonts arrive
  for (const s of steps) {
    // a missing element skips that step, so one wrong selector never loses the whole recording
    try {
    if (s.hold !== undefined && s.click === undefined) await hold(s.hold);
    else if (s.scroll !== undefined) await scrollBy(s.scroll * H, s.seconds ?? 3);
    else if (s.scrollTo) {
      const { box } = await locate(s.scrollTo);
      await scrollBy(box.y - H * 0.15, s.seconds ?? 2);
    } else if (s.move) await glide(await locate(s.move), s.seconds ?? 1);
    else if (s.click) {
      const t = await locate(s.click);
      await glide(t, s.seconds ?? 0.8);
      // zoom in on what gets clicked, ready to paste into the scene
      camera.push({ at: n - 15, x: t.x, y: t.y, zoom: 2 });
      cursor[cursor.length - 1].click = true;
      await t.el.click({ timeout: 5000 });
      await page.waitForLoadState('load', { timeout: 8000 }).catch(() => {});
      await hold(s.hold ?? 1.5);
      camera.push({ at: n, x: 0.5, y: 0.5, zoom: 1 });
    }
    } catch (e) {
      console.log(`SKIPPED ${JSON.stringify(s)}: ${String(e.message).split('\n')[0]}`);
    }
  }
} finally {
  await browser.close();
}

if (!n) throw new Error('No frames recorded: the steps did nothing');
mkdirSync(join(PUBLIC, 'screens'), { recursive: true });
const out = join(PUBLIC, 'screens', `${name}.mp4`);
ff('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', join(frames, '%06d.jpg'), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
rmSync(frames, { recursive: true, force: true });
writeFileSync(join(PUBLIC, 'screens', `${name}.json`), JSON.stringify({ src: `screens/${name}.mp4`, frames: n, cursor, camera }, null, 1));
console.log(`OK public/screens/${name}.mp4 (${(n / FPS).toFixed(1)}s, ${W * 2}x${H * 2}), cursor and camera in public/screens/${name}.json`);
