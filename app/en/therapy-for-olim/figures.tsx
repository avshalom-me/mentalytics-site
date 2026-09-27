// The article's three figures as inline SVG, so their text is real text (crisp
// at any size, readable by assistive tech) and they inherit the page's Heebo.
// English, left to right: the adjustment diagram is the mirror image of the
// Hebrew draft's right-to-left version.

const MUTED = "#6B807E";
const TEAL = "#3D8C8A";

function Box({ x, y, w, title, sub, fill, stroke, dashed, dark }: {
  x: number; y: number; w: number; title: string; sub: string;
  fill: string; stroke?: string; dashed?: boolean; dark?: boolean;
}) {
  const cx = x + w / 2;
  return (
    <g>
      <rect x={x} y={y} width={w} height={74} rx={16} fill={fill} stroke={stroke} strokeDasharray={dashed ? "5 4" : undefined} />
      <text x={cx} y={y + 30} textAnchor="middle" fontSize={17} fontWeight={800} fill={dark ? "#FFFFFF" : "#131F1E"}>{title}</text>
      <text x={cx} y={y + 54} textAnchor="middle" fontSize={13} fill={dark ? "#EAF4F3" : "#3E5250"}>{sub}</text>
    </g>
  );
}

export function AdjustmentCycleFigure() {
  return (
    <svg viewBox="0 0 900 410" width="100%" role="img" aria-labelledby="fig1-title fig1-desc" xmlns="http://www.w3.org/2000/svg" style={{ fontFamily: "inherit" }}>
      <title id="fig1-title">Adjustment is a cycle, not a ladder</title>
      <desc id="fig1-desc">
        The move leads to the start, then to friction. At the check, if distress is lasting and getting in the way of
        daily life, the path goes to professional help and then to building resources; if not, straight to building
        resources. From there to a flexible mix of both identities, then a shake-up such as war, a birth or a lost job, which leads
        back to friction with the resources already built.
      </desc>
      <defs>
        <marker id="fig1-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={MUTED} />
        </marker>
        <marker id="fig1-arT" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={TEAL} />
        </marker>
      </defs>
      {/* top row, left to right */}
      <Box x={18} y={26} w={170} title="The move" sub="Packing, goodbyes, landing" fill="#F7FAF9" stroke="#DDE9E8" />
      <Box x={228} y={26} w={178} title="The start" sub="Hope, and a long to-do list" fill="#FDF6E3" stroke="#f0e0b8" />
      <Box x={446} y={26} w={186} title="Friction" sub="Language, forms, loneliness" fill="#FDECEE" stroke="#F0A8AC" />
      <g>
        <path d="M772 10 L674 63 L772 116 L870 63 Z" fill="#EAF4F3" stroke={TEAL} strokeWidth={1.6} />
        <text x={772} y={52} textAnchor="middle" fontSize={12.5} fontWeight={800} fill="#2A6462">Distress lasting and</text>
        <text x={772} y={70} textAnchor="middle" fontSize={12.5} fontWeight={800} fill="#2A6462">getting in the way?</text>
      </g>
      {/* bottom row */}
      <Box x={684} y={250} w={176} title="Professional help" sub="Therapy, parent guidance" fill={TEAL} dark />
      <Box x={446} y={250} w={186} title="Building resources" sub="Language, community, routine" fill="#F7FAF9" stroke="#DDE9E8" />
      <Box x={228} y={250} w={178} title="A flexible mix" sub="Living with two identities" fill="#EAF4F3" stroke="#C2DFDE" />
      <Box x={18} y={250} w={170} title="A shake-up" sub="War, a birth, a lost job" fill="#FDF6E3" stroke="#f0e0b8" dashed />
      {/* top row arrows */}
      <line x1={190} y1={63} x2={224} y2={63} stroke={MUTED} strokeWidth={2} markerEnd="url(#fig1-ar)" />
      <line x1={408} y1={63} x2={442} y2={63} stroke={MUTED} strokeWidth={2} markerEnd="url(#fig1-ar)" />
      <line x1={634} y1={63} x2={670} y2={63} stroke={MUTED} strokeWidth={2} markerEnd="url(#fig1-ar)" />
      {/* the check: yes (down) and no (to resources) */}
      <line x1={772} y1={118} x2={772} y2={246} stroke={TEAL} strokeWidth={2.2} markerEnd="url(#fig1-arT)" />
      <text x={788} y={190} fontSize={13.5} fontWeight={800} fill="#2A6462">Yes</text>
      <path d="M710 96 C 650 150, 600 190, 570 246" fill="none" stroke={MUTED} strokeWidth={2} markerEnd="url(#fig1-ar)" />
      <text x={606} y={152} textAnchor="middle" fontSize={13.5} fontWeight={800} fill="#3E5250">No</text>
      {/* bottom row arrows, right to left */}
      <line x1={682} y1={287} x2={636} y2={287} stroke={TEAL} strokeWidth={2.2} markerEnd="url(#fig1-arT)" />
      <line x1={444} y1={287} x2={410} y2={287} stroke={MUTED} strokeWidth={2} markerEnd="url(#fig1-ar)" />
      <line x1={226} y1={287} x2={192} y2={287} stroke={MUTED} strokeWidth={2} strokeDasharray="5 4" markerEnd="url(#fig1-ar)" />
      {/* the loop back to friction */}
      <path d="M103 326 C 103 384, 426 384, 426 330 L 426 150 C 426 124, 448 112, 470 104" fill="none" stroke="#D49018" strokeWidth={2} strokeDasharray="6 5" markerEnd="url(#fig1-ar)" />
      <text x={264} y={400} textAnchor="middle" fontSize={13} fontWeight={700} fill="#A87010">Back to friction, with what you have built</text>
    </svg>
  );
}

// 0..4,500 olim maps onto 240px of bar height (y 280 down to 40).
const BARS = [
  { year: 2022, value: 3900, label: "3,900*", fill: "#C2DFDE" },
  { year: 2023, value: 3020, label: "3,020", fill: "#C2DFDE" },
  { year: 2024, value: 3706, label: "3,706", fill: TEAL },
  { year: 2025, value: 4150, label: "4,150", fill: "#2A6462" },
];

export function AliyahChartFigure() {
  const scale = 240 / 4500;
  return (
    <svg viewBox="0 0 900 330" width="100%" role="img" aria-labelledby="fig2-title fig2-desc" xmlns="http://www.w3.org/2000/svg" style={{ fontFamily: "inherit" }}>
      <title id="fig2-title">North American olim who came with Nefesh B&apos;Nefesh, 2022 to 2025</title>
      <desc id="fig2-desc">Bar chart: 3,900 in 2022 (a year-end estimate), 3,020 in 2023, 3,706 in 2024 and 4,150 in 2025, up 12% from 2024.</desc>
      <g stroke="#DDE9E8" strokeWidth={1}>
        <line x1={90} y1={280} x2={860} y2={280} />
        {[1000, 2000, 3000, 4000].map((v) => (
          <line key={v} x1={90} y1={280 - v * scale} x2={860} y2={280 - v * scale} strokeDasharray="3 4" />
        ))}
      </g>
      <g fontSize={12.5} fill="#A2B5B4" textAnchor="end">
        {[0, 1000, 2000, 3000, 4000].map((v) => (
          <text key={v} x={80} y={284 - v * scale}>{v.toLocaleString("en-US")}</text>
        ))}
      </g>
      {BARS.map((b, i) => {
        const x = 150 + i * 180;
        const h = b.value * scale;
        return (
          <g key={b.year}>
            <rect x={x} y={280 - h} width={120} height={h} rx={10} fill={b.fill} />
            <text x={x + 60} y={280 - h - 10} textAnchor="middle" fontSize={19} fontWeight={900} fill="#131F1E">{b.label}</text>
            <text x={x + 60} y={304} textAnchor="middle" fontSize={15} fontWeight={700} fill="#3E5250">{b.year}</text>
          </g>
        );
      })}
      <text x={750} y={324} textAnchor="middle" fontSize={12.5} fontWeight={700} fill="#D49018">Up 12% from 2024</text>
    </svg>
  );
}

export function TwoLanguagesFigure() {
  const left = "M110 150 C110 70 190 30 300 30 C420 30 500 80 500 150 C500 220 420 268 300 268 C258 268 222 262 192 250 L128 282 L146 228 C124 208 110 180 110 150 Z";
  const right = "M790 150 C790 70 710 30 600 30 C480 30 400 80 400 150 C400 220 480 268 600 268 C642 268 678 262 708 250 L772 282 L754 228 C776 208 790 180 790 150 Z";
  return (
    <svg viewBox="0 0 900 300" width="100%" role="img" aria-labelledby="fig3-title fig3-desc" xmlns="http://www.w3.org/2000/svg" style={{ fontFamily: "inherit" }}>
      <title id="fig3-title">Between two languages</title>
      <desc id="fig3-desc">
        Two overlapping speech bubbles, one with the English words I, feel, home, mom and why, and one with the same words
        in Hebrew. Where they overlap, the words turn into a heart, over the line: where you don&apos;t have to translate.
      </desc>
      <defs>
        <radialGradient id="fig3-gT" cx="35%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#C2DFDE" /><stop offset="100%" stopColor="#EAF4F3" />
        </radialGradient>
        <radialGradient id="fig3-gG" cx="65%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#F5D9A0" /><stop offset="100%" stopColor="#FDF6E3" />
        </radialGradient>
        <clipPath id="fig3-clipL"><path d={left} /></clipPath>
      </defs>
      <rect width={900} height={300} rx={18} fill="#FFFFFF" />
      <path d={left} fill="url(#fig3-gT)" />
      <path d={right} fill="url(#fig3-gG)" opacity={0.92} />
      <g clipPath="url(#fig3-clipL)"><path d={right} fill="#F0A8AC" opacity={0.45} /></g>
      <g fill="#2A6462" fontWeight={800}>
        <text x={170} y={118} fontSize={30} opacity={0.9}>I</text>
        <text x={200} y={168} fontSize={26} opacity={0.75}>feel</text>
        <text x={268} y={112} fontSize={22} opacity={0.6}>home</text>
        <text x={300} y={206} fontSize={20} opacity={0.5}>mom</text>
        <text x={362} y={160} fontSize={17} opacity={0.35}>why</text>
      </g>
      <g fill="#A87010" fontWeight={800} direction="rtl" lang="he">
        <text x={730} y={118} fontSize={30} opacity={0.9}>אני</text>
        <text x={700} y={170} fontSize={26} opacity={0.75}>מרגישה</text>
        <text x={610} y={112} fontSize={22} opacity={0.6}>בית</text>
        <text x={598} y={208} fontSize={20} opacity={0.5}>אמא</text>
        <text x={548} y={160} fontSize={17} opacity={0.35}>למה</text>
      </g>
      <g fill="#C45D63">
        {[[438, 128, 5, 0.55], [462, 128, 5, 0.55], [427, 140, 4.5, 0.65], [450, 142, 4.5, 0.65], [473, 140, 4.5, 0.65],
          [432, 156, 4.5, 0.75], [450, 160, 4.5, 0.75], [468, 156, 4.5, 0.75], [440, 172, 4, 0.85], [460, 172, 4, 0.85],
          [450, 186, 4, 0.95]].map(([cx, cy, r, o], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} opacity={o} />
        ))}
      </g>
      <text x={450} y={240} textAnchor="middle" fontSize={14} fontWeight={700} fill="#3E5250">Where you don&apos;t have to translate</text>
    </svg>
  );
}
