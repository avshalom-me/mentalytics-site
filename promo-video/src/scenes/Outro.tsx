import {AbsoluteFill, interpolate, spring, useCurrentFrame} from 'remotion';
import {FPS} from '../timeline';
import {Logo} from '../components/Logo';

export const Outro = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], {extrapolateRight: 'clamp'});
  const logoIn = spring({frame, fps: FPS, config: {damping: 14}, durationInFrames: 25});
  const tagIn = spring({frame: frame - 18, fps: FPS, config: {damping: 14}, durationInFrames: 22});
  const ctaIn = spring({frame: frame - 38, fps: FPS, config: {damping: 13}, durationInFrames: 22});
  const urlIn = interpolate(frame, [55, 70], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        opacity: fadeIn,
      }}
    >
      <div
        dir="rtl"
        style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 44}}
      >
        <div style={{transform: `scale(${0.8 + 0.2 * logoIn})`, opacity: logoIn}}>
          <Logo scale={1.7} />
        </div>
        <div
          style={{
            fontSize: 50,
            fontWeight: 700,
            color: '#3E5250',
            opacity: tagIn,
            transform: `translateY(${(1 - tagIn) * 30}px)`,
          }}
        >
          מפסיקים לנחש. מוצאים טיפול שמתאים באמת.
        </div>
        <div
          style={{
            background: '#3D8C8A',
            color: '#FFFFFF',
            fontSize: 40,
            fontWeight: 800,
            borderRadius: 50,
            padding: '24px 64px',
            opacity: ctaIn,
            transform: `scale(${0.85 + 0.15 * ctaIn})`,
            boxShadow: '0 16px 40px rgba(61,140,138,0.35)',
          }}
        >
          מתחילים בשאלון ההתאמה
        </div>
        <div style={{fontSize: 34, fontWeight: 500, color: '#6B807E', opacity: urlIn}}>
          mentalytics.co.il
        </div>
      </div>
    </AbsoluteFill>
  );
};
