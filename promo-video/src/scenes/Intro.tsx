import {AbsoluteFill, interpolate, spring, useCurrentFrame} from 'remotion';
import {FPS, INTRO} from '../timeline';
import {Logo} from '../components/Logo';

export const Intro = () => {
  const frame = useCurrentFrame();
  const enter = spring({frame, fps: FPS, config: {damping: 14}, durationInFrames: 25});
  const fadeOut = interpolate(frame, [INTRO - 12, INTRO - 2], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        opacity: fadeOut,
      }}
    >
      <div style={{transform: `scale(${0.8 + 0.2 * enter})`, opacity: enter}}>
        <Logo scale={1.6} />
      </div>
    </AbsoluteFill>
  );
};
