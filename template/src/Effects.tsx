import { ThreeCanvas } from '@remotion/three';
import { useMemo } from 'react';
import { AbsoluteFill, Img, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import * as THREE from 'three';
import { FONT } from './fonts';
import { H, W } from './Layouts';
import { SAFE } from './SafeZone';

const YELLOW = '#FFE14D';
const shadow = '0 6px 28px rgba(0,0,0,0.55)';

// ---- Text behind the head: the words sit on the speaker, the cut-out speaker (scripts/cutout.mjs) goes back on top
export const BehindText: React.FC<{ text: string; highlight?: string[]; y: number; len: number }> = ({ text, highlight = [], y, len }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 14, stiffness: 170 } });
  const exit = interpolate(f, [len - 6, len], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const hi = new Set(highlight.map((w) => w.toLowerCase()));
  const words = text.split(/\s+/);
  const longest = Math.max(...words.map((w) => w.length));
  const size = Math.min(300, Math.floor(1500 / Math.max(5, longest)));
  return (
    <AbsoluteFill style={{ alignItems: 'center' }}>
      <div style={{ position: 'absolute', top: y, width: 1040, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 0.95, letterSpacing: '-0.03em', opacity: exit, transform: `translateY(${(1 - enter) * 90}px) scale(${0.92 + enter * 0.08})` }}>
        {words.map((w, i) => (
          <span key={i} style={{ color: hi.has(w.toLowerCase()) ? YELLOW : 'white', textShadow: '0 8px 40px rgba(0,0,0,0.35)' }}>{w}{' '}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const CutoutLayer: React.FC<{ graphic: number; from: number }> = ({ graphic, from }) => {
  const f = useCurrentFrame();
  return <Img src={staticFile(`cutouts/${graphic}/${from + f}.png`)} style={{ position: 'absolute', inset: 0, width: W, height: H }} />;
};

// ---- A real 3D card: spins in, then floats. Front face = text or an image from public/images.
const cardTexture = (text: string, sub?: string) => {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 640;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 1024, 640);
  g.addColorStop(0, '#23262f');
  g.addColorStop(1, '#0c0d12');
  x.fillStyle = g;
  x.fillRect(0, 0, 1024, 640);
  x.fillStyle = YELLOW;
  x.fillRect(70, 70, 120, 14);
  x.fillStyle = 'white';
  x.textBaseline = 'middle';
  x.font = `900 ${text.length > 12 ? 92 : 124}px Inter, Arial`;
  x.fillText(text, 70, sub ? 290 : 340, 884);
  if (sub) {
    x.fillStyle = 'rgba(255,255,255,0.75)';
    x.font = '600 52px Inter, Arial';
    x.fillText(sub, 70, 420, 884);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

export const Card3D: React.FC<{ text: string; subtitle?: string; len: number }> = ({ text, subtitle, len }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 16, stiffness: 90 } });
  const exit = interpolate(f, [len - 8, len], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tex = useMemo(() => cardTexture(text, subtitle), [text, subtitle]);
  return (
    <AbsoluteFill style={{ opacity: exit }}>
      <ThreeCanvas width={W} height={H} camera={{ position: [0, 0, 6], fov: 40 }}>
        <ambientLight intensity={1.1} />
        <directionalLight position={[3, 4, 5]} intensity={2} />
        <group position={[0, 1.02, 0]} rotation={[0.12 + Math.sin(f / 22) * 0.05, (1 - enter) * Math.PI * 1.5 + Math.sin(f / 30) * 0.22, 0]} scale={0.6 + enter * 0.4}>
          <mesh>
            <boxGeometry args={[1.84, 1.15, 0.07]} />
            <meshStandardMaterial attach="material-0" color="#2b2e39" />
            <meshStandardMaterial attach="material-1" color="#2b2e39" />
            <meshStandardMaterial attach="material-2" color="#2b2e39" />
            <meshStandardMaterial attach="material-3" color="#2b2e39" />
            <meshStandardMaterial attach="material-4" map={tex} roughness={0.35} metalness={0.2} />
            <meshStandardMaterial attach="material-5" color={YELLOW} />
          </mesh>
        </group>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

// ---- Liquid glass: blurs and bends what is behind it, with a bright rim
export const Glass: React.FC<{ text: string; subtitle?: string; len: number; id: string }> = ({ text, subtitle, len, id }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 15, stiffness: 150 } });
  const exit = interpolate(f, [len - 6, len], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ top: SAFE.top + 70, height: 420, justifyContent: 'center', alignItems: 'center' }}>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter id={id} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.012" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="46" xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </svg>
      <div
        style={{
          position: 'relative',
          padding: '44px 64px',
          borderRadius: 64,
          maxWidth: 840,
          textAlign: 'center',
          opacity: exit,
          transform: `translateY(${(1 - enter) * -70}px) scale(${0.86 + enter * 0.14})`,
          backdropFilter: `url(#${id}) saturate(1.5) brightness(1.08)`,
          WebkitBackdropFilter: 'blur(18px) saturate(1.5)',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.28), rgba(255,255,255,0.07) 45%, rgba(255,255,255,0.16))',
          boxShadow: 'inset 0 2px 2px rgba(255,255,255,0.75), inset 0 -2px 3px rgba(255,255,255,0.25), 0 24px 70px rgba(0,0,0,0.35)',
          border: '1.5px solid rgba(255,255,255,0.4)',
        }}
      >
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: text.length > 14 ? 76 : 100, color: 'white', textShadow: shadow, lineHeight: 1.05, letterSpacing: '-0.02em' }}>{text}</div>
        {subtitle ? <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 44, color: 'rgba(255,255,255,0.92)', textShadow: shadow, marginTop: 10 }}>{subtitle}</div> : null}
      </div>
    </AbsoluteFill>
  );
};

// ---- Shader overlays: GPU-drawn light over the picture (brightness = opacity), used at transitions and big moments
const SHADERS: Record<string, string> = {
  // a warm light leak drifting across
  leak: `float n=sin(uv.x*3.+t*5.)*.5+.5; vec3 c=mix(vec3(1.,.42,.1),vec3(1.,.8,.3),n);
    float a=smoothstep(.75,.0,distance(uv,vec2(t*1.4-.2,.4+.3*sin(t*3.))))*sin(t*3.1416); col=c*a*1.1;`,
  // a bright diagonal bar sweeping over
  sweep: `float d=uv.x+uv.y*.5-(t*2.2-.4); float a=exp(-d*d*38.)+exp(-d*d*260.)*.8; col=vec3(1.,.97,.9)*a*sin(t*3.1416);`,
  // a ring of light expanding from the centre
  ripple: `float r=distance(uv*vec2(.5625,1.),vec2(.28,.5)); float d=r-t*.9; float a=exp(-d*d*220.)*(1.-t); col=vec3(.75,.88,1.)*a*1.3;`,
};

export const Shader: React.FC<{ effect: string; len: number }> = ({ effect, len }) => {
  const f = useCurrentFrame();
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { t: { value: 0 } },
        transparent: true,
        depthTest: false,
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
        fragmentShader: `varying vec2 vUv; uniform float t; void main(){ vec2 uv=vUv; vec3 col=vec3(0.); ${SHADERS[effect] ?? SHADERS.sweep} float alpha=clamp(max(col.r,max(col.g,col.b)),0.,1.); gl_FragColor=vec4(alpha>0.?col/alpha:col,alpha); }`,
      }),
    [effect],
  );
  material.uniforms.t.value = f / Math.max(1, len - 1);
  return (
    <AbsoluteFill>
      <ThreeCanvas width={W} height={H}>
        <mesh frustumCulled={false} material={material}>
          <planeGeometry args={[2, 2]} />
        </mesh>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

// ---- A transparent effect rendered by HyperFrames (see references/hyperframes.md), placed like any graphic
export const HyperframeClip: React.FC<{ src: string; muted?: boolean }> = ({ src }) => (
  <AbsoluteFill>
    <OffthreadVideo src={staticFile(src)} transparent muted style={{ width: '100%', height: '100%' }} />
  </AbsoluteFill>
);
