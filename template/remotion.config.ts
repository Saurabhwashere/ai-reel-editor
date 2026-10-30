import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// 'angle' makes WebGL (3D scenes) render on Macs; harmless for 2D
Config.setChromiumOpenGlRenderer('angle');
