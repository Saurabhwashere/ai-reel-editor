import { Audio, Sequence, interpolate, staticFile, useVideoConfig } from 'remotion';
import type { EditCaption, Music } from './types';

const DUCK = 0.4; // music drops to 40% of its level while you speak
const RAMP = 8; // frames to dip / come back
const FADE_IN = 10;
const FADE_OUT = 30;

// 'whoosh' -> public/sfx/whoosh.mp3; a name with an extension is used as given (public/sfx/my-sound.wav)
export const sfxFile = (sound: string) => staticFile(`sfx/${/\.\w{2,4}$/.test(sound) ? sound : `${sound}.mp3`}`);

// Quiet background music: fades in and out, dips under speech, loops if shorter than the reel
export const MusicBed: React.FC<{ music: Music; words: EditCaption[] }> = ({ music, words }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const level = music.volume ?? 0.12;
  const spans = words.map((w) => [(w.startMs / 1000) * fps, (w.endMs / 1000) * fps] as const);
  const distanceToSpeech = (f: number) => {
    let d = Infinity;
    for (const [a, b] of spans) {
      if (f >= a && f <= b) return 0;
      d = Math.min(d, Math.abs(f - a), Math.abs(f - b));
    }
    return d;
  };
  return (
    <Audio
      src={staticFile(`music/${music.src}`)}
      loop
      trimBefore={music.trimBefore}
      volume={(f) => {
        const duck = interpolate(distanceToSpeech(f), [0, RAMP], [DUCK, 1], { extrapolateRight: 'clamp' });
        const fade = Math.min(1, f / FADE_IN, (durationInFrames - f) / FADE_OUT);
        return Math.max(0, level * duck * fade);
      }}
    />
  );
};

export type PlacedSfx = { at: number; sound: string; volume: number };

export const SoundEffects: React.FC<{ cues: PlacedSfx[] }> = ({ cues }) => (
  <>
    {cues.map((c, i) => (
      <Sequence key={`${c.at}-${i}`} from={c.at} durationInFrames={90} name={`sfx ${c.sound}`}>
        <Audio src={sfxFile(c.sound)} volume={c.volume} />
      </Sequence>
    ))}
  </>
);
