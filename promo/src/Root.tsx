import { Composition } from 'remotion';
import { Promo } from './Promo';
import timeline from './timeline.json';

// Vertical 1080×1920 a 30 fps: formato de TikTok / Reels / Shorts
export const Root = () => (
  <Composition id="ConcursoTikTok" component={Promo} durationInFrames={timeline.total} fps={timeline.fps} width={1080} height={1920} />
);
