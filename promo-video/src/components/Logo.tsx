export const Logo = ({scale = 1}: {scale?: number}) => (
  <div dir="rtl" style={{display: 'flex', alignItems: 'center', gap: 20 * scale}}>
    <div style={{display: 'flex', gap: 16 * scale, alignItems: 'baseline'}}>
      <span style={{color: '#3D8C8A', fontWeight: 800, fontSize: 72 * scale, lineHeight: 1}}>
        טיפול
      </span>
      <span style={{color: '#D49018', fontWeight: 900, fontSize: 72 * scale, lineHeight: 1}}>
        חכם
      </span>
    </div>
    <svg
      width={66 * scale}
      height={56 * scale}
      viewBox="0 0 66 56"
      style={{overflow: 'visible'}}
    >
      <path
        d="M6 26 Q26 4 50 26"
        stroke="#3D8C8A"
        strokeWidth="5.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M16 30 Q36 52 60 30"
        stroke="#D49018"
        strokeWidth="5.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  </div>
);
