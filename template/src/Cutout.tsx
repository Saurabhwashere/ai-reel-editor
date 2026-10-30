import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';
import { useEffect, useRef, useState } from 'react';
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame } from 'remotion';

// One frame of the speaker with everything else transparent. Rendered by scripts/cutout.mjs, never part of the reel.
export type CutoutProps = { from: number; count: number };

let model: Promise<ImageSegmenter> | null = null;
const loadModel = () =>
  (model ??= FilesetResolver.forVisionTasks(staticFile('mediapipe/wasm')).then((vision) =>
    ImageSegmenter.createFromOptions(vision, {
      baseOptions: { modelAssetPath: staticFile('mediapipe/selfie_multiclass.tflite'), delegate: 'CPU' },
      runningMode: 'IMAGE',
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    }),
  ));

export const Cutout: React.FC<CutoutProps> = ({ from }) => {
  const frame = useCurrentFrame();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [handle] = useState(() => delayRender('Cutting out the speaker', { timeoutInMilliseconds: 120000 }));

  useEffect(() => {
    const run = async () => {
      const seg = await loadModel();
      const img = new Image();
      img.src = staticFile(`cutouts/_src/${from + frame}.jpg`);
      await img.decode();

      // Mask 0 = background: the speaker is everything else (hair, skin, clothes)
      const result = seg.segment(img);
      const bg = result.confidenceMasks![0];
      const data = bg.getAsFloat32Array();
      const mask = document.createElement('canvas');
      mask.width = bg.width;
      mask.height = bg.height;
      const mctx = mask.getContext('2d')!;
      const px = mctx.createImageData(bg.width, bg.height);
      for (let i = 0; i < data.length; i++) {
        // tighten the soft model edge a little so no background halo shows around the head
        const a = Math.min(1, Math.max(0, (1 - data[i] - 0.35) / 0.4));
        px.data[i * 4 + 3] = a * 255;
      }
      mctx.putImageData(px, 0, 0);
      result.close();

      const c = canvas.current!;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.imageSmoothingQuality = 'high';
      ctx.filter = 'blur(2px)';
      ctx.drawImage(mask, 0, 0, c.width, c.height);
      continueRender(handle);
    };
    run().catch((e) => {
      console.error(e);
      throw e;
    });
  }, [frame, from, handle]);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <canvas ref={canvas} width={1080} height={1920} />
    </AbsoluteFill>
  );
};
