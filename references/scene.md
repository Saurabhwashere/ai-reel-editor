# scene.json: layouts, graphics, screen recordings, sound

Claude writes `public/scene.json` after the storyboard is approved. The reel reads it at render time.
No scene.json = plain talking head with captions.

## Times
Every `at` / `until` is either:
- a word: `{ "word": 12 }` = the moment word 12 starts (numbers from `node scripts/words.mjs`)
- a word plus frames: `{ "word": 12, "offset": -3 }` (3 frames early)
- a reel frame: `90` (30 frames = 1 second)

Prefer words. They stay right after a re-cut. A graphic whose start word was cut is skipped.
`until` left out = 2 seconds on screen.

## Layouts
| kind | What you see | Use for |
|---|---|---|
| `talking` | speaker fills the frame (default) | most of the reel |
| `split` | content on top half, speaker below | showing a thing while still talking to camera |
| `full` | content fills the frame, speaker hidden, voice continues | screen demos, big lists |
| `pip` | content full, speaker in a round bubble top-right | long screen demos |

A layout lasts until the next change. Switches slide over 9 frames. Go back with `"kind": "talking"`.

## Graphics
| kind | Fields | Where it sits |
|---|---|---|
| `headline` | `text`, `highlight` (words in yellow) | band above the head; words pop in one by one |
| `keyword` | `text` (1–2 words) | band above the head; huge, yellow underline sweeps |
| `list` | `title`, `items: [{ text, at }]` | content box (or centred card); each item appears on its own word |
| `stat` | `value`, `prefix`, `suffix`, `label` | number counts up |
| `image` | `src` (in `public/images/`), `caption` | content box (or big and centred) |
| `tag` | `title`, `subtitle` | top-left name tag (who / which tool) |
| `screen` | `src` (in `public/screens/`), `trimBefore`, `camera`, `cursor` | content box; muted |
| `behind` | `text`, `highlight`, `y` (top of the text, default 300) | huge words behind the head; `talking` layout only |
| `card3d` | `text`, `subtitle` | real 3D card spins in, upper part of the frame |
| `glass` | `text`, `subtitle` | liquid-glass panel that bends what is behind it |
| `shader` | `effect`: `sweep`, `leak`, `ripple` | light over the picture; 0.5–1.5 s, at a transition or big moment |
| `hyperframe` | `src` (in `public/hyperframes/`) | a transparent effect made with HyperFrames (below) |

Any graphic or layout change can carry `"sfx": "whoosh"` to play a sound on its first frame.

## Screen recordings and camera moves
Claude can record any public website itself. Do this first; only ask the user to record for apps or signed-in pages.

1. Record a site: `node scripts/record-site.mjs https://example.com --name demo --steps steps.json`
   (about 4 s of work per 1 s of video). Steps: `hold`, `scroll`, `scrollTo`, `move`, `click` (options at the top of the script).
   ```json
   [{ "hold": 1 }, { "scroll": 1.5, "seconds": 3 }, { "click": "text=Pricing", "hold": 1.5 }]
   ```
   Selectors are Playwright's: `text=Pricing`, `a[href*='docs']`. A `SKIPPED` line means that step found nothing: fix the
   selector and record again. It writes `public/screens/demo.json`: paste its `cursor` and `camera` into the `screen` graphic.
   Never sign in, submit forms, buy or post while recording. Look at a frame for cookie banners or popups, then add a `click` to close them.
   Or bring in the user's own recording: `node scripts/ingest.mjs <file> --to screens/demo.mp4` (converts, removes sound).
2. Show it with a `screen` graphic, usually with layout `full`, `pip` or `split`.
3. `camera` = keyframes; `at` is a frame inside the clip (0 = when it appears).
   `x`, `y` = the point to centre (0 to 1 across the screen), `zoom` = 1 shows the whole screen.
   ```json
   "camera": [
     { "at": 0,  "x": 0.5,  "y": 0.5,  "zoom": 1 },
     { "at": 20, "x": 0.25, "y": 0.15, "zoom": 2.2 },
     { "at": 70, "x": 0.25, "y": 0.15, "zoom": 2.2 },
     { "at": 95, "x": 0.5,  "y": 0.5,  "zoom": 1 }
   ]
   ```
4. Find `x`, `y` by looking at a frame of the recording: `npx remotion ffmpeg -ss 2 -i public/screens/demo.mp4 -frames:v 1 exports/screen.png`.
   The thing being clicked or typed into is the target.
5. Camera rules: zoom 1.8–2.5 to read text. Move at least 15 frames. Hold at least 30 frames after a move.
   Never zoom past 3 (blurry).

6. Cursor: for recordings made with the system cursor hidden, add a smooth pointer. `at` is a frame inside the clip,
   `click` adds a press and a ring. Same `x`, `y` as the camera, so point both at the same target:
   `"cursor": [{ "at": 0, "x": 0.3, "y": 0.8 }, { "at": 40, "x": 0.62, "y": 0.47, "click": true }]`

## Text behind the head
1. Add a `behind` graphic. One short word or two: it has to read around the head. Use `"y"` so the letters overlap the top of the head.
2. Run `node scripts/cutout.mjs` (about 1 s per 3 frames). Without it the render fails. Run it again after any re-cut.
3. Check the head edges on a frame. Fast hands and busy backgrounds cut less cleanly. Keep these shots under 2 seconds.

## Effects
Use at most 2–3 per reel. They are the seasoning, and the slowest things to render.
- `card3d` covers part of the band above the head: best when the speaker's face sits low, or in a `full` layout.
- `glass` needs something behind it to bend, so it looks best over the speaker or a screen, not a plain wall.
- `shader` picks: `sweep` for a reveal, `leak` for a warm transition, `ripple` for an impact.

## HyperFrames effects (optional)
For a look Remotion has no graphic for: hand-drawn annotations, complex type animation, ready-made catalog effects.
Remotion stays the editor; HyperFrames only supplies one transparent clip.
1. Needs Node 22+ and a real ffmpeg 5+ (not only Remotion's). `hf.mjs` says what to install if one is missing.
2. `node scripts/hf.mjs new <name>` creates `hyperframes/<name>/index.html` (1080x1920).
3. Edit it. Keep `html, body { background: transparent }`. Set `data-duration` on `#root` to the seconds you need. Animate with a
   paused GSAP timeline stored in `window.__timelines["main"]`. Give timed elements `class="clip"`, `data-start`, `data-duration`.
4. `node scripts/hf.mjs render <name>` writes `public/hyperframes/<name>.webm`.
5. Place it: `{ "kind": "hyperframe", "src": "hyperframes/<name>.webm", "at": { "word": 53 }, "until": { "word": 59 } }`.

## Music and sound effects
- Music: `node scripts/ingest.mjs <file> --to music/bed.mp3`, then `"music": { "src": "bed.mp3", "volume": 0.12 }`.
  It fades in and out, loops, and dips under speech by itself. Only music the user owns or that is CC0.
- Sound effects ship in `public/sfx/`: 24 sounds made in code with earshot (MIT; see `CREDITS.md`).
  whoosh, swoosh, pop, bubble, tick, hit, riser, glitch (each also as `<name>-2`), plus click, ding, shimmer,
  sub-drop, typing, sting, shutter, zip.
  `"sfx": [{ "at": { "word": 5 }, "sound": "pop", "volume": 0.45 }]`
- Which sound where: whoosh or swoosh = something moves in (layout switch, image). pop or bubble = text appears.
  tick = list item. hit = a big claim or number. riser = build-up before a reveal. glitch = a "wait, what" moment.
  click = a button or link mentioned. ding = a result or notification. typing = text being typed on screen.
  shutter = a screenshot appears. sting = the end card or CTA. sub-drop = a heavy reveal.
- Land the loud part on the moment. Most sounds peak within 0.06 s, so start them on the word.
  These peak later; start them early with `offset` (frames, 30 = 1 s):
  riser `-38`, riser-2 `-21`, glitch `-20`, glitch-2 `-15`, whoosh-2 `-11`, shimmer `-11`, sub-drop `-7`, hit-2 `-5`, whoosh `-5`.
  Example: `{ "at": { "word": 93, "offset": -38 }, "sound": "riser" }` peaks exactly on word 93.
- Fewer is better: about one sound every 3–5 seconds. Offer a list; the user usually cuts a third.
- After rendering: `node scripts/check-audio.mjs exports/<name>.mp4`.

## Design rules for graphics
1. One idea, one graphic. Never two graphics on screen at once (a list's items count as one).
2. Start on the word it belongs to. Graphics arrive already moving; no slow fades.
3. Hold long enough to read: at least 1.5 seconds, plus 0.3 seconds per extra word.
4. Show what the words cannot: a number, a list, a screen, a name. Do not repeat the captions as a headline.
5. Max about 8 words on screen. Short words, big type.
6. Everything inside the safe zone (check the preview with `"safeZone": true`).
7. Use layouts to make room. Big things (screens, images, long lists) go in `split`, `full` or `pip`, not over the face.
8. Leave the first 2 seconds to the hook and the face. Viewers decide in that time.

## Example
```json
{
  "hook": { "text": "I let Claude edit my reels", "variant": "box", "until": 75 },
  "layouts": [
    { "at": { "word": 9 }, "kind": "split", "sfx": "whoosh" },
    { "at": { "word": 20 }, "kind": "talking", "sfx": "swoosh" }
  ],
  "graphics": [
    { "kind": "keyword", "text": "0 edits", "at": { "word": 4 }, "until": { "word": 8 }, "sfx": "hit" },
    { "kind": "screen", "src": "screens/demo.mp4", "at": { "word": 9 }, "until": { "word": 20 },
      "camera": [{ "at": 0, "x": 0.5, "y": 0.5, "zoom": 1 }, { "at": 25, "x": 0.3, "y": 0.2, "zoom": 2 }] },
    { "kind": "list", "title": "3 steps", "at": { "word": 21 }, "until": { "word": 30 },
      "items": [{ "text": "Drop a clip", "at": { "word": 22 } }, { "text": "Approve", "at": { "word": 25 } }, { "text": "Post", "at": { "word": 28 } }] }
  ],
  "music": { "src": "bed.mp3", "volume": 0.12 },
  "sfx": [{ "at": { "word": 22 }, "sound": "tick" }]
}
```
