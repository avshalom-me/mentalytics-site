import {Composition} from 'remotion';
import {PromoVideo} from './PromoVideo';
import {FPS, TOTAL} from './timeline';

export const Root = () => (
  <Composition
    id="promo"
    component={PromoVideo}
    durationInFrames={TOTAL}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
