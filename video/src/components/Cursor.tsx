// Stylised cursor that flies between focal points on screen. Black arrow
// with a white outline so it reads on every background.
export const Cursor: React.FC<{ x: number; y: number; click?: number }> = ({
  x,
  y,
  click = 0,
}) => {
  const ringScale = 1 + click * 1.5;
  const ringOpacity = Math.max(0, 1 - click);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        pointerEvents: "none",
        transform: "translate(-4px, -4px)",
        zIndex: 50,
      }}
    >
      <svg width={32} height={32} viewBox="0 0 32 32">
        <path
          d="M4 2 L4 22 L10 18 L14 28 L18 26 L14 16 L22 16 Z"
          fill="#1B2A4E"
          stroke="white"
          strokeWidth={1.5}
        />
      </svg>
      {click > 0 ? (
        <svg
          width={70}
          height={70}
          viewBox="0 0 70 70"
          style={{
            position: "absolute",
            left: -20,
            top: -20,
            transform: `scale(${ringScale})`,
            opacity: ringOpacity,
          }}
        >
          <circle cx={35} cy={35} r={18} fill="none" stroke="white" strokeWidth={3} />
        </svg>
      ) : null}
    </div>
  );
};
