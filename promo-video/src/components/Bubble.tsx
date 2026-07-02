import {interpolate, spring, useCurrentFrame} from 'remotion';
import {FPS, Speaker} from '../timeline';

export const Bubble = ({
  speaker,
  text,
  dur,
}: {
  speaker: Speaker;
  text: string;
  dur: number;
}) => {
  const frame = useCurrentFrame();
  const enter = spring({frame, fps: FPS, config: {damping: 13}, durationInFrames: 16});
  const exit = interpolate(frame, [dur - 10, dur - 2], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // standing guy is on the right side of the frame, sitting guy on the left
  const side: React.CSSProperties =
    speaker === 'standing' ? {right: 150, top: 90} : {left: 170, top: 110};
  const tailSide: React.CSSProperties =
    speaker === 'standing' ? {right: 110} : {left: 130};

  return (
    <div
      style={{
        position: 'absolute',
        ...side,
        maxWidth: 780,
        opacity: exit,
        transform: `scale(${0.7 + 0.3 * enter})`,
        transformOrigin: speaker === 'standing' ? '85% 100%' : '15% 100%',
      }}
    >
      <div
        dir="rtl"
        style={{
          background: '#FFFFFF',
          border: '3px solid #DDE9E8',
          borderRadius: 26,
          padding: '26px 38px',
          fontSize: 42,
          fontWeight: 500,
          lineHeight: 1.45,
          color: '#131F1E',
          textAlign: 'right',
          boxShadow: '0 14px 40px rgba(19,31,30,0.10)',
        }}
      >
        {text}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: -20,
          ...tailSide,
          width: 0,
          height: 0,
          borderLeft: '18px solid transparent',
          borderRight: '18px solid transparent',
          borderTop: '22px solid #FFFFFF',
          filter: 'drop-shadow(0 3px 0 #DDE9E8)',
        }}
      />
    </div>
  );
};
