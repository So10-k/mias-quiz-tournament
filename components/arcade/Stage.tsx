// Full-bleed dark gradient stage with drifting particles + diagonal stripe
// glow lines. Picks up the Brawl-Stars-store mood: deep purple, neon cyan
// and magenta corner glows, soft starfield. The rest of the page sits on
// top via a relative-positioned content wrapper.

const stars = Array.from({ length: 60 }).map((_, i) => {
  const seed = (i * 9301 + 49297) % 233280;
  const x = (seed / 233280) * 100;
  const y = ((seed * 1.7) % 233280) / 2332.8;
  const size = ((i % 3) + 1) * 1.2;
  const delay = (i % 7) * 0.4;
  return { x, y, size, delay };
});

export function ArcadeStage({
  children,
  scrollable = false,
}: {
  children: React.ReactNode;
  scrollable?: boolean;
}) {
  return (
    <div className="arcade-root">
      <style>{`
        .arcade-root {
          position: relative;
          min-height: 100vh;
          ${scrollable ? "" : "height: 100vh; overflow: hidden;"}
          background:
            radial-gradient(ellipse 90% 70% at 20% 0%, rgba(255,45,117,0.22), transparent 60%),
            radial-gradient(ellipse 80% 70% at 100% 100%, rgba(0,240,255,0.20), transparent 60%),
            radial-gradient(ellipse 70% 60% at 50% 50%, rgba(120,60,255,0.18), transparent 65%),
            linear-gradient(180deg, #14062E 0%, #0B0322 60%, #050010 100%);
          color: #F4ECFF;
          overflow-x: hidden;
        }
        .arcade-grid {
          position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(180,120,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(180,120,255,0.05) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 30%, rgba(0,0,0,0.7) 70%, transparent 100%);
        }
        .arcade-stripe {
          position: absolute; inset: 0; pointer-events: none;
          background: repeating-linear-gradient(
            45deg,
            transparent 0px,
            transparent 80px,
            rgba(0,240,255,0.025) 80px,
            rgba(0,240,255,0.025) 82px
          );
        }
        .arcade-glow-l, .arcade-glow-r {
          position: absolute; pointer-events: none; filter: blur(60px); opacity: .55;
        }
        .arcade-glow-l {
          top: -120px; left: -120px; width: 480px; height: 480px;
          background: radial-gradient(circle, #FF2D75 0%, transparent 70%);
        }
        .arcade-glow-r {
          bottom: -120px; right: -120px; width: 520px; height: 520px;
          background: radial-gradient(circle, #00F0FF 0%, transparent 70%);
        }
        .arcade-star {
          position: absolute;
          background: white;
          border-radius: 999px;
          opacity: 0.6;
          animation: arcade-twinkle 3.6s ease-in-out infinite;
        }
        @keyframes arcade-twinkle {
          0%, 100% { opacity: 0.15; transform: scale(0.85); }
          50%      { opacity: 0.95; transform: scale(1.15); }
        }
        .arcade-content {
          position: relative;
          z-index: 1;
          ${scrollable ? "" : "height: 100%; overflow-y: auto;"}
        }
        .arcade-hairline-top {
          position: absolute; top: 0; left: 0; right: 0; height: 4px;
          background: linear-gradient(90deg, #FFCC00 0%, #FF2D75 25%, #B23AFF 50%, #00F0FF 75%, #2CFF8A 100%);
          background-size: 200% 100%;
          animation: arcade-shine 5s linear infinite;
          z-index: 2;
        }
        @keyframes arcade-shine {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
      <div className="arcade-hairline-top" />
      <div className="arcade-grid" aria-hidden />
      <div className="arcade-stripe" aria-hidden />
      <div className="arcade-glow-l" aria-hidden />
      <div className="arcade-glow-r" aria-hidden />
      <div aria-hidden>
        {stars.map((s, i) => (
          <span
            key={i}
            className="arcade-star"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="arcade-content">{children}</div>
    </div>
  );
}
