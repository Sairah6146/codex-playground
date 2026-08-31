const BAND_COLOR_VAR = {
  'Strong Match': '--strong',
  'Good Match': '--good',
  'Possible Match': '--possible',
  'Weak Match': '--weak',
};

export default function MatchRing({ score, band, size = 64 }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const colorVar = BAND_COLOR_VAR[band] || '--accent';

  return (
    <div className="match-ring-wrap" title={band}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth="6"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`var(${colorVar})`}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="52%"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.28}
          fontWeight="800"
          fill="var(--text)"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        >
          {score}
        </text>
      </svg>
      <span className="match-ring-band" style={{ color: `var(${colorVar})` }}>{band}</span>
    </div>
  );
}
