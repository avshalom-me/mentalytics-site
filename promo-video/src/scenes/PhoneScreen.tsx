import {AbsoluteFill, interpolate, spring, useCurrentFrame} from 'remotion';
import {FPS} from '../timeline';

const THERAPISTS = [
  {initials: 'יכ', name: 'ד"ר יעל כהן', sub: 'פסיכולוגית קלינית · תל אביב', match: 94},
  {initials: 'אל', name: 'אורי לוי', sub: 'פסיכולוג קליני · אונליין', match: 89},
  {initials: 'מב', name: 'מיכל ברק', sub: 'פסיכולוגית קלינית · רמת גן', match: 84},
];

const Card = ({
  t,
  delay,
  frame,
  rank,
}: {
  t: (typeof THERAPISTS)[number];
  delay: number;
  frame: number;
  rank: number;
}) => {
  const enter = spring({
    frame: frame - delay,
    fps: FPS,
    config: {damping: 14},
    durationInFrames: 20,
  });
  return (
    <div
      dir="rtl"
      style={{
        background: '#FFFFFF',
        border: '2px solid #DDE9E8',
        borderRadius: 18,
        padding: '14px 16px',
        opacity: enter,
        transform: `translateY(${(1 - enter) * 40}px)`,
        boxShadow: '0 8px 22px rgba(19,31,30,0.06)',
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 10,
            background: rank === 1 ? '#D49018' : '#EAF4F3',
            color: rank === 1 ? '#FFFFFF' : '#2A6462',
            fontWeight: 900,
            fontSize: 17,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {rank}
        </div>
        <div
          style={{
            width: 50,
            height: 50,
            borderRadius: '50%',
            background: '#C2DFDE',
            color: '#2A6462',
            fontWeight: 800,
            fontSize: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {t.initials}
        </div>
        <div style={{flex: 1, minWidth: 0, overflow: 'hidden'}}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 22,
              color: '#131F1E',
              whiteSpace: 'nowrap',
            }}
          >
            {t.name}
          </div>
          <div
            style={{
              fontSize: 15,
              color: '#6B807E',
              marginTop: 2,
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
            }}
          >
            {t.sub}
          </div>
        </div>
        <div
          style={{
            background: '#EAF4F3',
            color: '#2A6462',
            fontWeight: 900,
            fontSize: 17,
            borderRadius: 50,
            padding: '7px 13px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {t.match}% התאמה
        </div>
      </div>
      <div
        style={{
          marginTop: 10,
          height: 8,
          borderRadius: 4,
          background: '#EFF5F5',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${t.match * enter}%`,
            borderRadius: 4,
            background: 'linear-gradient(90deg, #3D8C8A, #2A6462)',
          }}
        />
      </div>
    </div>
  );
};

export const PhoneScreen = ({dur}: {dur: number}) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(frame, [dur - 12, dur - 2], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const phoneUp = spring({frame, fps: FPS, config: {damping: 15}, durationInFrames: 25});
  const captionIn = spring({
    frame: frame - 12,
    fps: FPS,
    config: {damping: 14},
    durationInFrames: 22,
  });

  return (
    <AbsoluteFill
      style={{
        background: '#FFFFFF',
        opacity: Math.min(fadeIn, fadeOut),
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 110,
      }}
    >
      {/* caption — on the right, RTL reading order */}
      <div
        dir="rtl"
        style={{
          order: 1,
          maxWidth: 640,
          opacity: captionIn,
          transform: `translateX(${(1 - captionIn) * -50}px)`,
        }}
      >
        <div style={{fontSize: 58, fontWeight: 900, color: '#131F1E', lineHeight: 1.25}}>
          רשימה מדורגת של מטפלים —
          <br />
          <span style={{color: '#3D8C8A'}}>לפי הצרכים והאישיות שלך</span>
        </div>
        <div style={{marginTop: 36, display: 'flex', flexDirection: 'column', gap: 18}}>
          {[
            'שאלון שנבנה על ידי פסיכולוגים קליניים',
            'מזהה קודם מה הבעיה ואיזה טיפול מתאים',
            'ואז מדרג עבורך את המטפלים המתאימים',
          ].map((line, i) => (
            <div key={i} style={{display: 'flex', alignItems: 'center', gap: 14}}>
              <svg width={30} height={30} viewBox="0 0 30 30">
                <circle cx={15} cy={15} r={14} fill="#EAF4F3" />
                <path
                  d="M9 15.5 L13.5 20 L21.5 10.5"
                  stroke="#3D8C8A"
                  strokeWidth={3.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
              <span style={{fontSize: 29, color: '#3E5250', fontWeight: 500}}>{line}</span>
            </div>
          ))}
        </div>
      </div>
      {/* phone — on the left */}
      <div
        style={{
          order: 2,
          width: 470,
          height: 920,
          borderRadius: 58,
          border: '13px solid #131F1E',
          background: '#F7FAF9',
          overflow: 'hidden',
          transform: `translateY(${(1 - phoneUp) * 120}px)`,
          boxShadow: '0 30px 80px rgba(19,31,30,0.18)',
        }}
      >
        <div
          dir="rtl"
          style={{
            padding: '30px 26px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            height: '100%',
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center'}}>
            <span style={{color: '#3D8C8A', fontWeight: 800, fontSize: 30}}>טיפול</span>
            <span style={{color: '#D49018', fontWeight: 900, fontSize: 30}}>חכם</span>
          </div>
          <div
            style={{
              background: '#FDF6E3',
              border: '2px solid #F0E3C2',
              borderRadius: 16,
              padding: '14px 18px',
              fontSize: 21,
              color: '#131F1E',
            }}
          >
            <span style={{fontWeight: 800, color: '#A87010'}}>ההמלצה שלך: </span>
            טיפול קוגניטיבי־התנהגותי (CBT)
          </div>
          <div style={{fontSize: 24, fontWeight: 800, color: '#131F1E', marginTop: 4}}>
            המטפלים המותאמים לך ביותר:
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
            {THERAPISTS.map((t, i) => (
              <Card key={i} t={t} rank={i + 1} delay={22 + i * 14} frame={frame} />
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
