// Inter ships inside the project (@fontsource/inter), so renders look the same on Mac and Windows and need no internet
import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';
import '@fontsource/inter/900.css';
import { continueRender, delayRender } from 'remotion';

export const FONT = 'Inter, Helvetica, Arial, sans-serif';

const handle = delayRender('Loading Inter');
Promise.all(['600 40px Inter', '800 40px Inter', '900 40px Inter'].map((f) => document.fonts.load(f)))
  .then(() => continueRender(handle))
  .catch(() => continueRender(handle));
