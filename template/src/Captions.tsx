import { createTikTokStyleCaptions, type Caption } from '@remotion/captions';
import { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { SAFE } from './SafeZone';

// Word-by-word captions: a few words per page, the word being said in yellow. Sits above Instagram's bottom bar.
const WORDS_TOGETHER_MS = 900;

// bottomPx = distance from the frame's bottom edge to the caption block (default: just above Instagram's bottom bar)
export const Captions: React.FC<{ captions: Caption[]; offsetMs?: number; bottomPx?: number; pill?: boolean }> = ({ captions, offsetMs = 0, bottomPx = SAFE.bottom + 140, pill = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = (frame / fps) * 1000 + offsetMs;
  const { pages } = useMemo(
    () => createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: WORDS_TOGETHER_MS }),
    [captions],
  );
  const page = pages.find((p) => nowMs >= p.startMs && nowMs < p.startMs + p.durationMs);
  if (!page) return null;

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: bottomPx, paddingLeft: SAFE.left + 40, paddingRight: SAFE.right + 40 }}>
      <div
        style={{
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontWeight: 800,
          fontSize: 76,
          lineHeight: 1.1,
          textAlign: 'center',
          color: 'white',
          textShadow: '0 4px 18px rgba(0,0,0,0.75)',
          // over a screen recording the page may be white: a dark pill keeps white words readable
          ...(pill ? { background: 'rgba(10,10,14,0.82)', padding: '14px 30px', borderRadius: 24, textShadow: 'none' } : {}),
          whiteSpace: 'pre-wrap',
        }}
      >
        {/* key by position: two words can share a start time, and a duplicate key leaves a stale word on later pages */}
        {page.tokens.map((t, i) => (
          <span key={`${page.startMs}-${i}`} style={{ color: nowMs >= t.fromMs && nowMs < t.toMs ? '#FFE14D' : 'white' }}>
            {t.text}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
