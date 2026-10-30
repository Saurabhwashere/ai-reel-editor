---
name: ai-reel-editor
description: "Edits raw talking-head clips into a finished Instagram reel with Remotion: installs its own tools on first run (Mac and Windows), then cuts, captions and renders. Trigger with /ai-reel-editor or phrases like 'edit my video', 'edit this clip', 'make this a reel'."
---

# /ai-reel-editor

Raw clip in, finished reel out. The user never opens a terminal or an editor.
Talk in short plain lines. Ask one question at a time.

`SK` = this skill's folder (the one holding this SKILL.md), as a full path.
The user's folder = `Desktop/ai-reel-editor/`: `raw/` (clips in), `exports/` (reels out).
The engine = `~/.ai-reel-editor/project/` (hidden; Remotion + Whisper). `exports/` inside it links to the Desktop one.

## Step 0: Setup (every run; installs only on the first)

1. Run `node -v`.
   - Works and is v18 or newer: go to 2.
   - Missing or older: install Node, then go to 2.
     - Mac: `brew install node`. No Homebrew? Tell the user to install it from https://brew.sh, then stop.
     - Windows: `winget install --id OpenJS.NodeJS.LTS -e`. Then tell the user to quit and reopen Claude, and stop.
2. Run `node "SK/scripts/setup.mjs"`.
   - Prints `READY`: read `~/.ai-reel-editor/.machine.json` and continue.
   - Prints `NOT READY`: each failed `STATUS` line ends with its fix. Do the fix, run setup again.
   - The first run downloads about 1 GB. Tell the user it takes a few minutes.
3. ffmpeg comes with Remotion. Never ask the user to install it.
   Use the `ffmpeg` and `ffprobe` commands from `.machine.json`, run from the `project` folder.

## Step 1: Transcribe and cut

Run everything from `~/.ai-reel-editor/project/`.

1. Bring in the footage:
   - One clip: `node scripts/ingest.mjs` (takes the newest video in `Desktop/ai-reel-editor/raw/`).
   - Several clips or takes: `node scripts/ingest.mjs --all` (joins everything in `raw/`, in name order).
     Ask first if `raw/` holds old clips: `--all` uses every file there.
   - Prints `NO CLIP`: ask the user to drop one in, and stop.
   - iPhone `.mov`, HEVC and odd frame rates are converted to H.264 30 fps. Never skip this.
2. It also clears the last edit (`captions.json`, `edit.json`).
3. Transcribe, passing names and keywords the user will say:
   `node scripts/transcribe.mjs "Claude, Claude Code, <other names>"`
   - The first run builds Whisper and downloads a 1.5 GB model. Tell the user it takes a few minutes, once.
   - It prints the full transcript. Check it against what the user meant.
4. Fix wrong words in `public/captions.json` (only the `text` field; keep the leading space).
   Whisper often hears "Claude" as "cloud" or "claws".
5. Cut the pauses: `node scripts/cut.mjs`
   - Repeated takes: `node scripts/takes.mjs` lists lines said more than once, with word numbers.
   - Drop the worse takes, "um", false starts: `node scripts/cut.mjs --drop "12-20,45-53"`.
     Usually keep the last take of a line. Word numbers come from captions.json (0 = first word).
   - It prints old length, new length, and words kept. Every word kept, unless dropped on purpose.

## Step 2: Graphics, layouts, screen recordings, sound

Read `SK/references/scene.md` first. It has the format, the design rules and an example.

1. `node scripts/words.mjs` prints every word with its number and time.
2. Get anything to show. Any website the script names: record it yourself with `node scripts/record-site.mjs`
   (`scene.md`, "Screen recordings"); never ask the user to record a public site. Ask only for private things:
   - their own screen recording (apps, signed-in pages): `node scripts/ingest.mjs <file> --to screens/<name>.mp4`
   - image: `node scripts/ingest.mjs <file> --to images/<name>.png`
   - music: `node scripts/ingest.mjs <file> --to music/<name>.mp3` (only music they own or CC0)
3. Propose a numbered plan: for each moment, the word, the layout, the graphic, the sound. Wait for a yes.
   Offer a few more sounds than needed and mark the optional ones.
4. Write `public/scene.json`. Point at words (`{ "word": 12 }`), not frames.
   With `behind` graphics, run `node scripts/cutout.mjs`. With a HyperFrames effect, render it first.
5. Check a stretch fast: one range render, not many stills:
   `npx remotion render Reel exports/check --sequence --frames=60-120 --props='<same props, "safeZone":true>'`
   Look at a few of the JPEGs (names are zero-padded, e.g. `element-064.jpeg`), then delete the folder.

## Step 3: Storyboard review

Skip only if the user says so ("no storyboard", "just render it").

1. Run `node scripts/storyboard.mjs` in the background. It renders a small preview, opens a page with one looping
   clip per beat, and waits. Tell the user: rate each beat Keep, Maybe or Drop, then press Submit review.
2. When it exits, its output and `storyboard/review.json` hold the notes. Apply every Maybe and Drop.
3. Write `storyboard/answers.json` (`{ "<beat id>": "what changed" }`) so the next round shows your answers.
4. Run it again until a round comes back with nothing to change.

## Step 4: Preview and render

1. Preview with the safe zone:
   `npx remotion still Reel exports/preview.png --frame=45 --props='{"clip":"clip.mp4","title":"","safeZone":true,"captions":true,"edit":null,"scene":{},"screenSizes":{}}'`
   Look at the PNG. Captions and faces must stay out of the red areas.
2. Render:
   `npx remotion render Reel exports/<name>.mp4 --props='{"clip":"clip.mp4","title":"<hook text or empty>","safeZone":false,"captions":true,"edit":null,"scene":{},"screenSizes":{}}'`
   - `edit`, `scene` and `screenSizes` stay empty: the reel loads `public/edit.json` and `public/scene.json` by itself.
   - On Windows PowerShell, put the props in a `props.json` file and pass `--props=props.json`.
3. Master the sound: `node scripts/finish.mjs exports/<name>.mp4` -> `exports/<name>-final.mp4` (the file to post).
   Then `node scripts/check-audio.mjs exports/<name>-final.mp4` and `node scripts/check-video.mjs exports/<name>-final.mp4`.
   Every line should say `OK`: frame count, one-frame flashes, black frames, frozen stretches, loudness, peak. Fix any `FIX` line.
   Move the un-mastered `<name>.mp4` out of `exports/` so the user only sees the final one.
4. Tell the user where the final file is, how long it is, and how many seconds were cut.

Coming next: website screenshots, free images, style learning.
