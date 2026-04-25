// A grassy hill at the bottom of the stage, with a few flowers.
export function Hill() {
  return (
    <svg
      viewBox="0 0 1440 240"
      preserveAspectRatio="none"
      className="absolute bottom-0 left-0 w-full pointer-events-none"
      style={{ height: "180px" }}
      role="img"
      aria-hidden="true"
    >
      <path
        d="M0 120 C 240 60 480 60 720 110 C 960 160 1200 160 1440 100 L 1440 240 L 0 240 Z"
        fill="var(--grass)"
        stroke="var(--navy)"
        strokeWidth="3"
      />
      <path
        d="M0 160 C 200 130 420 130 720 165 C 1020 200 1240 195 1440 160 L 1440 240 L 0 240 Z"
        fill="var(--grass-deep)"
      />
      {/* Flowers */}
      <g>
        {[
          [120, 138, "var(--coral)"],
          [320, 132, "var(--sun)"],
          [560, 142, "var(--cloud)"],
          [820, 148, "var(--sun)"],
          [1080, 138, "var(--coral)"],
          [1280, 132, "var(--cloud)"],
        ].map(([x, y, color], i) => (
          <g key={i} transform={`translate(${x},${y})`}>
            <line x1="0" y1="0" x2="0" y2="14" stroke="var(--grass-deep)" strokeWidth="2" />
            <circle cx="0" cy="0" r="6" fill={color as string} stroke="var(--navy)" strokeWidth="2" />
            <circle cx="0" cy="0" r="2" fill="var(--navy)" />
          </g>
        ))}
      </g>
    </svg>
  );
}
