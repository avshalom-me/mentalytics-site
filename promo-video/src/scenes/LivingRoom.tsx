import {AbsoluteFill} from 'remotion';
import {Speaker} from '../timeline';
import {Logo} from '../components/Logo';

const SKIN = '#F1C6A2';
const SKIN_2 = '#E2B189';

const Face = ({
  cx,
  cy,
  talking,
  frame,
  lookDown = false,
  glasses = false,
}: {
  cx: number;
  cy: number;
  talking: boolean;
  frame: number;
  lookDown?: boolean;
  glasses?: boolean;
}) => {
  const mouthRy = talking ? 3 + Math.abs(Math.sin(frame * 0.55)) * 6 : 1.8;
  const eyeY = cy - 6 + (lookDown ? 4 : 0);
  return (
    <g>
      <circle cx={cx - 16} cy={eyeY} r={4.2} fill="#131F1E" />
      <circle cx={cx + 16} cy={eyeY} r={4.2} fill="#131F1E" />
      {glasses && (
        <g stroke="#2A6462" strokeWidth={3} fill="none">
          <circle cx={cx - 16} cy={eyeY} r={11} />
          <circle cx={cx + 16} cy={eyeY} r={11} />
          <line x1={cx - 5} y1={eyeY} x2={cx + 5} y2={eyeY} />
        </g>
      )}
      <ellipse cx={cx} cy={cy + 18 + (lookDown ? 3 : 0)} rx={8.5} ry={mouthRy} fill="#8C4A3E" />
    </g>
  );
};

// Sofa + sitting guy, viewBox 0 0 700 430
const SittingGuy = ({talking, frame}: {talking: boolean; frame: number}) => {
  const bob = talking ? Math.sin(frame * 0.5) * 3 : 0;
  const thumb = Math.sin(frame * 0.35) * 7;
  return (
    <svg
      viewBox="0 0 700 430"
      style={{position: 'absolute', left: 130, bottom: 105, width: 720}}
    >
      {/* shadow */}
      <ellipse cx={350} cy={412} rx={300} ry={16} fill="rgba(19,31,30,0.08)" />
      {/* sofa backrest */}
      <rect x={70} y={120} width={560} height={150} rx={30} fill="#35807E" />
      {/* body behind seat */}
      <g transform={`translate(0 ${bob})`}>
        {/* torso */}
        <rect x={265} y={148} width={130} height={150} rx={32} fill="#D49018" />
        {/* head */}
        <circle cx={330} cy={102} r={46} fill={SKIN} />
        {/* hair */}
        <path d="M284 96 A46 46 0 0 1 376 96 L376 84 Q330 40 284 84 Z" fill="#4A3728" />
        <Face cx={330} cy={104} talking={talking} frame={frame} lookDown />
        {/* far arm (his left) resting */}
        <path
          d="M285 180 Q255 220 285 245"
          stroke="#B87A12"
          strokeWidth={24}
          strokeLinecap="round"
          fill="none"
        />
        {/* near arm holding phone */}
        <path
          d="M380 180 Q425 205 428 228"
          stroke="#D49018"
          strokeWidth={24}
          strokeLinecap="round"
          fill="none"
        />
        {/* phone */}
        <g transform={`rotate(-12 438 230)`}>
          <rect x={418} y={188} width={44} height={80} rx={9} fill="#131F1E" />
          <rect x={423} y={195} width={34} height={64} rx={5} fill="#EAF4F3" />
          {/* scrolling "photos" inside the phone */}
          <rect x={427} y={202 + (thumb % 10)} width={26} height={16} rx={3} fill="#C2DFDE" />
          <rect x={427} y={224 + (thumb % 10)} width={26} height={16} rx={3} fill="#F0A8AC" opacity={0.7} />
        </g>
        {/* thumb */}
        <circle cx={432} cy={232 + thumb * 0.4} r={9} fill={SKIN} />
      </g>
      {/* seat cushions (in front of body) */}
      <rect x={90} y={255} width={255} height={70} rx={24} fill="#3D8C8A" />
      <rect x={355} y={255} width={255} height={70} rx={24} fill="#3D8C8A" />
      {/* sofa base */}
      <rect x={70} y={315} width={560} height={60} rx={22} fill="#2A6462" />
      {/* armrests */}
      <rect x={42} y={190} width={72} height={185} rx={32} fill="#2A6462" />
      <rect x={586} y={190} width={72} height={185} rx={32} fill="#2A6462" />
      {/* legs of sofa */}
      <rect x={100} y={375} width={20} height={28} rx={6} fill="#7A5A3A" />
      <rect x={580} y={375} width={20} height={28} rx={6} fill="#7A5A3A" />
      {/* guy's legs in front of the sofa */}
      <g transform={`translate(0 ${bob * 0.3})`}>
        <path
          d="M330 290 Q400 300 415 330 L415 385"
          stroke="#33475F"
          strokeWidth={34}
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M300 292 Q355 308 362 335 L362 388"
          stroke="#2A3B50"
          strokeWidth={34}
          strokeLinecap="round"
          fill="none"
        />
        {/* shoes */}
        <rect x={395} y={385} width={62} height={22} rx={11} fill="#131F1E" />
        <rect x={342} y={388} width={60} height={22} rx={11} fill="#232F3B" />
      </g>
    </svg>
  );
};

// Standing guy, viewBox 0 0 320 630
const StandingGuy = ({talking, frame}: {talking: boolean; frame: number}) => {
  const bob = Math.sin(frame * 0.12) * 3;
  const gesture = talking ? Math.sin(frame * 0.4) * 10 : 0;
  return (
    <svg
      viewBox="0 0 320 630"
      style={{position: 'absolute', right: 330, bottom: 108, width: 310}}
    >
      <ellipse cx={160} cy={612} rx={105} ry={13} fill="rgba(19,31,30,0.08)" />
      {/* legs */}
      <rect x={122} y={370} width={32} height={215} rx={14} fill="#2F3E4E" />
      <rect x={168} y={370} width={32} height={215} rx={14} fill="#3A4B5E" />
      {/* shoes */}
      <rect x={106} y={580} width={64} height={24} rx={12} fill="#131F1E" />
      <rect x={158} y={580} width={64} height={24} rx={12} fill="#131F1E" />
      <g transform={`translate(0 ${bob})`}>
        {/* torso */}
        <rect x={100} y={205} width={122} height={185} rx={30} fill="#3D8C8A" />
        {/* resting arm (his right, viewer left) */}
        <path
          d="M112 240 Q88 300 96 362"
          stroke="#2A6462"
          strokeWidth={24}
          strokeLinecap="round"
          fill="none"
        />
        <circle cx={97} cy={370} r={11} fill={SKIN_2} />
        {/* gesturing arm (points toward the sofa when talking) */}
        <g transform={`rotate(${-18 - gesture} 212 238)`}>
          <path
            d="M212 238 Q258 250 282 232"
            stroke="#3D8C8A"
            strokeWidth={24}
            strokeLinecap="round"
            fill="none"
          />
          <circle cx={288} cy={228} r={12} fill={SKIN_2} />
        </g>
        {/* head */}
        <circle cx={160} cy={152} r={48} fill={SKIN_2} />
        {/* hair — short curls */}
        <path d="M113 142 Q118 92 160 90 Q204 92 207 142 L207 128 Q198 96 160 96 Q122 96 113 128 Z" fill="#26211E" />
        <path d="M112 145 A48 48 0 0 1 208 145 L208 122 Q160 78 112 122 Z" fill="#26211E" />
        <Face cx={160} cy={158} talking={talking} frame={frame} glasses />
      </g>
    </svg>
  );
};

export const LivingRoom = ({
  talking,
  frame,
}: {
  talking: Speaker | null;
  frame: number;
}) => {
  return (
    <AbsoluteFill>
      {/* wall */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, #F7FAF9 0%, #EFF5F5 100%)',
        }}
      />
      {/* floor */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 150,
          background: '#EFE3CF',
          borderTop: '3px solid #E3D4BA',
        }}
      />
      {/* rug */}
      <div
        style={{
          position: 'absolute',
          left: 240,
          bottom: 60,
          width: 900,
          height: 90,
          background: '#FDF6E3',
          borderRadius: '50%',
          border: '4px solid #F0E3C2',
        }}
      />
      {/* window */}
      <svg viewBox="0 0 300 240" style={{position: 'absolute', left: 1360, top: 120, width: 300}}>
        <rect x={6} y={6} width={288} height={228} rx={14} fill="#EAF4F3" stroke="#FFFFFF" strokeWidth={14} />
        <line x1={150} y1={14} x2={150} y2={226} stroke="#FFFFFF" strokeWidth={10} />
        <line x1={14} y1={120} x2={286} y2={120} stroke="#FFFFFF" strokeWidth={10} />
        <circle cx={90} cy={70} r={24} fill="#FDF6E3" stroke="#D49018" strokeWidth={3} opacity={0.9} />
      </svg>
      {/* picture frame with the brand arcs */}
      <svg viewBox="0 0 130 110" style={{position: 'absolute', left: 1030, top: 150, width: 130}}>
        <rect x={4} y={4} width={122} height={102} rx={10} fill="#FFFFFF" stroke="#DDE9E8" strokeWidth={6} />
        <path d="M33 56 Q53 32 80 56" stroke="#3D8C8A" strokeWidth={5} strokeLinecap="round" fill="none" />
        <path d="M45 62 Q65 84 92 62" stroke="#D49018" strokeWidth={5} strokeLinecap="round" fill="none" />
      </svg>
      {/* plant */}
      <svg viewBox="0 0 160 260" style={{position: 'absolute', left: 40, bottom: 115, width: 150}}>
        <path d="M80 150 Q40 90 55 30" stroke="#3D8C8A" strokeWidth={10} strokeLinecap="round" fill="none" />
        <path d="M80 150 Q80 70 95 25" stroke="#35807E" strokeWidth={10} strokeLinecap="round" fill="none" />
        <path d="M80 150 Q115 100 125 55" stroke="#2A6462" strokeWidth={10} strokeLinecap="round" fill="none" />
        <ellipse cx={55} cy={28} rx={16} ry={26} fill="#3D8C8A" transform="rotate(-20 55 28)" />
        <ellipse cx={96} cy={22} rx={15} ry={26} fill="#35807E" />
        <ellipse cx={126} cy={52} rx={15} ry={24} fill="#2A6462" transform="rotate(22 126 52)" />
        <path d="M45 150 L115 150 L104 235 Q80 245 56 235 Z" fill="#D49018" />
        <rect x={42} y={143} width={76} height={16} rx={8} fill="#A87010" />
      </svg>
      <SittingGuy talking={talking === 'sitting'} frame={frame} />
      <StandingGuy talking={talking === 'standing'} frame={frame} />
      {/* small watermark logo */}
      <div style={{position: 'absolute', top: 36, left: 48, opacity: 0.92}}>
        <Logo scale={0.55} />
      </div>
    </AbsoluteFill>
  );
};
