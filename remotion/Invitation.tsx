// Still-image composition for the finals invitation PNG. Rendered
// via `remotion still`. Picture-book brand, deliberately premium-
// looking — heavy paper feel, varnished sun crest, double-rule
// border, embossed type. The same vibe as the recording placeholder
// but pushed to wall-art polish.

import { AbsoluteFill } from "remotion";

export const INVITATION_WIDTH = 1200;
export const INVITATION_HEIGHT = 1600;

export const Invitation: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#1B2A4E" }}>
      {/* Paper background with subtle grain via stacked gradients */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 30% 25%, #FFF7E1 0%, #FFEFC8 55%, #FAE39B 100%)",
        }}
      />
      {/* Speckled noise for paper texture */}
      <AbsoluteFill style={{ opacity: 0.18, mixBlendMode: "multiply" }}>
        <svg width="100%" height="100%">
          <filter id="noise">
            <feTurbulence baseFrequency="2" numOctaves="2" />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .5 0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#noise)" />
        </svg>
      </AbsoluteFill>

      {/* Inner navy border + corner motifs */}
      <div
        style={{
          position: "absolute",
          inset: 60,
          border: "5px solid #1B2A4E",
          borderRadius: 24,
          boxShadow:
            "inset 0 0 0 14px transparent, inset 0 0 0 16px #FFD93D, inset 0 0 0 19px #1B2A4E",
        }}
      />

      {/* Corner stars */}
      <CornerStar x={92} y={92} />
      <CornerStar x={INVITATION_WIDTH - 92} y={92} flip />
      <CornerStar x={92} y={INVITATION_HEIGHT - 92} />
      <CornerStar x={INVITATION_WIDTH - 92} y={INVITATION_HEIGHT - 92} flip />

      {/* Content stack */}
      <div
        style={{
          position: "absolute",
          inset: 110,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          textAlign: "center",
        }}
      >
        {/* Top: brand crest */}
        <div style={{ marginTop: 60 }}>
          <CrestSun size={170} />
          <div
            style={{
              fontFamily: "Quicksand, sans-serif",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "0.45em",
              color: "#3B4A7E",
              marginTop: 18,
              textTransform: "uppercase",
            }}
          >
            Mia&rsquo;s Quiz Tournament
          </div>
        </div>

        {/* Middle: the BIG hero */}
        <div style={{ position: "relative" }}>
          <div
            style={{
              fontFamily: "Fredoka, sans-serif",
              fontWeight: 700,
              fontSize: 50,
              color: "#C9296A",
              letterSpacing: "0.55em",
              textTransform: "uppercase",
              marginBottom: -8,
            }}
          >
            You&rsquo;re Invited
          </div>
          <div
            style={{
              fontFamily: "Fredoka, sans-serif",
              fontWeight: 700,
              fontSize: 150,
              color: "#1B2A4E",
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
              textShadow:
                "8px 8px 0 rgba(255,217,61,0.95), 12px 12px 0 #C9296A",
              padding: "0 30px",
            }}
          >
            THE GRAND
            <br />
            FINAL
          </div>
          <div
            style={{
              marginTop: 12,
              display: "inline-block",
              padding: "10px 28px",
              fontFamily: "Quicksand, sans-serif",
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#FFFFFF",
              background: "#1B2A4E",
              borderRadius: 999,
              border: "3px solid #FFD93D",
            }}
          >
            🎙️ Live Broadcast
          </div>
        </div>

        {/* When / where panel */}
        <div
          style={{
            background: "#FFFFFF",
            border: "5px solid #1B2A4E",
            borderRadius: 22,
            boxShadow: "10px 10px 0 #C9296A",
            padding: "30px 48px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: 56, alignItems: "baseline" }}>
            <KvBlock label="When" big="Saturday" small="May 16, 2026" />
            <Divider />
            <KvBlock label="Tip-off" big="12:00 PM" small="Eastern (NY · DC)" />
          </div>
          <div
            style={{
              fontFamily: "Quicksand, sans-serif",
              fontSize: 17,
              color: "#3B4A7E",
              fontWeight: 600,
              maxWidth: 720,
              lineHeight: 1.45,
            }}
          >
            Two bracket finals. Four finalists. One champion. Watch live from
            anywhere — registration link in your inbox.
          </div>
        </div>

        {/* Finalists */}
        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            paddingLeft: 24,
            paddingRight: 24,
            gap: 18,
          }}
        >
          <FinalistTile
            bracket="Winners"
            a="Karen"
            b="Marc"
            accent="#FFD93D"
          />
          <FinalistTile
            bracket="Losers"
            a="Grandpa"
            b="Sam"
            accent="#E94B7E"
          />
        </div>

        {/* Footer URL */}
        <div
          style={{
            fontFamily: "Quicksand, sans-serif",
            fontSize: 17,
            color: "#3B4A7E",
            fontWeight: 700,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
          }}
        >
          quiz.miaswebsites.art / finals
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CornerStar: React.FC<{ x: number; y: number; flip?: boolean }> = ({
  x,
  y,
  flip,
}) => (
  <div
    style={{
      position: "absolute",
      left: x - 40,
      top: y - 40,
      width: 80,
      height: 80,
      transform: flip ? "scaleX(-1)" : "none",
    }}
  >
    <svg viewBox="0 0 80 80" width={80} height={80}>
      <path
        d="M 40 6 L 47 33 L 74 40 L 47 47 L 40 74 L 33 47 L 6 40 L 33 33 Z"
        fill="#FFD93D"
        stroke="#1B2A4E"
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <circle cx={40} cy={40} r={6} fill="#E94B7E" />
    </svg>
  </div>
);

const CrestSun: React.FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 200 200" width={size} height={size}>
    <g stroke="#1B2A4E" strokeWidth={5} strokeLinecap="round" fill="none">
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => {
        const r = (a * Math.PI) / 180;
        return (
          <line
            key={a}
            x1={100 + Math.cos(r) * 80}
            y1={100 + Math.sin(r) * 80}
            x2={100 + Math.cos(r) * 96}
            y2={100 + Math.sin(r) * 96}
          />
        );
      })}
    </g>
    <circle
      cx={100}
      cy={100}
      r={64}
      fill="#FFD93D"
      stroke="#1B2A4E"
      strokeWidth={5}
    />
    <circle cx={80} cy={92} r={7} fill="#1B2A4E" />
    <circle cx={120} cy={92} r={7} fill="#1B2A4E" />
    <path
      d="M 78 116 Q 100 138 122 116"
      fill="none"
      stroke="#1B2A4E"
      strokeWidth={5}
      strokeLinecap="round"
    />
    <circle cx={74} cy={112} r={6} fill="#E94B7E" opacity={0.7} />
    <circle cx={126} cy={112} r={6} fill="#E94B7E" opacity={0.7} />
  </svg>
);

const KvBlock: React.FC<{ label: string; big: string; small: string }> = ({
  label,
  big,
  small,
}) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
    <div
      style={{
        fontFamily: "Quicksand, sans-serif",
        fontSize: 13,
        letterSpacing: "0.32em",
        textTransform: "uppercase",
        color: "#C9296A",
        fontWeight: 700,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: "Fredoka, sans-serif",
        fontSize: 56,
        fontWeight: 700,
        color: "#1B2A4E",
        lineHeight: 1.05,
        marginTop: 4,
      }}
    >
      {big}
    </div>
    <div
      style={{
        fontFamily: "Quicksand, sans-serif",
        fontSize: 18,
        color: "#3B4A7E",
        fontWeight: 600,
        marginTop: 2,
      }}
    >
      {small}
    </div>
  </div>
);

const Divider: React.FC = () => (
  <div
    style={{
      width: 4,
      height: 80,
      background: "#1B2A4E",
      borderRadius: 4,
      opacity: 0.3,
    }}
  />
);

const FinalistTile: React.FC<{
  bracket: string;
  a: string;
  b: string;
  accent: string;
}> = ({ bracket, a, b, accent }) => (
  <div
    style={{
      flex: 1,
      background: accent,
      border: "4px solid #1B2A4E",
      borderRadius: 18,
      boxShadow: "6px 6px 0 #1B2A4E",
      padding: "22px 18px",
      textAlign: "center",
    }}
  >
    <div
      style={{
        fontFamily: "Quicksand, sans-serif",
        fontSize: 13,
        letterSpacing: "0.28em",
        textTransform: "uppercase",
        color: "#1B2A4E",
        fontWeight: 700,
      }}
    >
      {bracket} bracket
    </div>
    <div
      style={{
        fontFamily: "Fredoka, sans-serif",
        fontSize: 38,
        fontWeight: 700,
        color: "#1B2A4E",
        marginTop: 6,
        lineHeight: 1.05,
      }}
    >
      {a}
      <span style={{ fontStyle: "italic", margin: "0 14px", fontSize: 26 }}>
        vs
      </span>
      {b}
    </div>
  </div>
);
