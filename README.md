# ai-reel-editor

Edit your Instagram reels by talking to Claude. No editing skills needed.

Film a video, drop it in a folder, and Claude cuts the pauses, adds captions, graphics and sound, then shows you a storyboard to review.

> **Beta.** Tested on a Mac with real footage. Windows and brand-new computers are not tested yet.

## Get started

**1. Get Claude.** Install the [Claude desktop app](https://claude.com/download) and open **Code**. Claude Code needs a paid Claude plan.

**2. Install the skill.** Paste this into Claude:

```text
Install this skill by cloning https://github.com/Saurabhwashere/ai-reel-editor into ~/.claude/skills/ai-reel-editor
```

**3. Edit a video.** Start a new chat and type:

```text
/ai-reel-editor
```

Claude sets up its own tools the first time. It downloads over 1 GB, so give it a while. It creates a folder on your Desktop. Drop your clip in `ai-reel-editor/raw/`, and your finished reel lands in `ai-reel-editor/exports/`.

## What it does

- Cuts pauses and finds repeated takes across several clips
- Adds word-by-word captions
- Adds headlines, lists, numbers, images and text behind your head
- Switches layouts: full screen, split screen, face bubble
- Records public websites by itself, with smooth scrolling and zooms
- Adds 3D cards, liquid glass and light effects
- Adds sound effects (24 included) and lowers your music under your voice
- Shows a storyboard page: Keep, Maybe or Drop each moment
- Checks every render for glitches, frame count and loudness

## What gets installed

| Tool | Job |
|---|---|
| Node.js | Runs everything |
| Remotion | Builds the video |
| ffmpeg | Cuts video and sound (comes with Remotion) |
| Whisper | Writes the captions |
| Playwright | Records websites |
| MediaPipe | Finds you in the frame, for text behind your head |
| HyperFrames | Optional special effects, used only when asked |

Mac users may need Homebrew and Xcode Command Line Tools. Claude tells you if so.

## Licences

The code here is MIT. Other pieces keep their own terms:

- **Remotion** is free for individuals and companies of up to 3 people. Larger companies need a [Remotion licence](https://www.remotion.dev/license).
- **Sound effects** were made with [earshot](https://github.com/Leonxlnx/earshot) (MIT). See `template/public/sfx/CREDITS.md`.
- **Person-cutout model** is Google's [MediaPipe](https://ai.google.dev/edge/mediapipe) selfie segmenter.

Only use music, footage and websites you have the right to use.

---

Made by [@saurabhs.builds](https://instagram.com/saurabhs.builds)
