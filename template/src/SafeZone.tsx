import { AbsoluteFill } from 'remotion';

// Areas Instagram covers on a 1080x1920 reel: top bar, caption + audio at the bottom, buttons on the right.
// Keep text and faces out of the red. Preview only: render with safeZone=false for the final file.
export const SAFE = { top: 220, bottom: 420, right: 140, left: 60 };

const red = 'rgba(255, 0, 0, 0.28)';

export const SafeZone: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: SAFE.top, background: red }} />
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: SAFE.bottom, background: red }} />
    <div style={{ position: 'absolute', top: SAFE.top, bottom: SAFE.bottom, right: 0, width: SAFE.right, background: red }} />
    <div style={{ position: 'absolute', top: SAFE.top, bottom: SAFE.bottom, left: 0, width: SAFE.left, background: red }} />
  </AbsoluteFill>
);
