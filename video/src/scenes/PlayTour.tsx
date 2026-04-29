import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { palette, fonts, shadows } from "../theme";
import { BrowserChrome } from "../components/BrowserChrome";
import { PopButton } from "../components/PopButton";

// 15 seconds = 450 frames. Cycle through four pages: home, bracket, players,
// standings. Each page sits on screen for ~110 frames with a swoosh between.
const PAGE_FRAMES = 110;

export const PlayTour: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardIn = spring({ frame, fps, config: { damping: 14 } });

  const pages = [PageHome, PageBracket, PagePlayers, PageStandings];
  const urls = [
    "quiz.miaswebsites.art/play",
    "quiz.miaswebsites.art/bracket",
    "quiz.miaswebsites.art/players",
    "quiz.miaswebsites.art/standings",
  ];

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          transform: `scale(${0.85 + cardIn * 0.15})`,
        }}
      >
        {pages.map((Page, idx) => {
          const start = idx * PAGE_FRAMES;
          const end = start + PAGE_FRAMES;
          const t = frame - start;
          const opacity = interpolate(
            frame,
            [start - 8, start, end - 8, end],
            [0, 1, 1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const slide = interpolate(t, [0, 12], [60, 0], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          });
          if (opacity <= 0.001) return null;
          return (
            <div
              key={idx}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: `translate(-50%, calc(-50% + ${slide}px))`,
                opacity,
              }}
            >
              <BrowserChrome url={urls[idx]} width={1500}>
                <Page />
              </BrowserChrome>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ──────────────────────────────────────────────────────────────
const StagePad: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      background: palette.sky1,
      padding: 36,
      minHeight: 660,
      borderBottomLeftRadius: 18,
      borderBottomRightRadius: 18,
    }}
  >
    {children}
  </div>
);

const PageHome: React.FC = () => {
  return (
    <StagePad>
      <h1
        style={{
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 64,
          color: palette.navy,
          margin: "0 0 6px",
        }}
      >
        Welcome back, Mia! 🌞
      </h1>
      <p
        style={{
          fontFamily: fonts.body,
          fontSize: 22,
          color: palette.navySoft,
          margin: "0 0 30px",
        }}
      >
        The first round is open. Good luck!
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
        <div
          style={{
            background: "white",
            border: `4px solid ${palette.navy}`,
            borderRadius: 24,
            boxShadow: shadows.popLg,
            padding: 32,
          }}
        >
          <p
            style={{
              fontFamily: fonts.display,
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: 2,
              color: palette.coralDeep,
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Active round
          </p>
          <h2
            style={{
              fontFamily: fonts.display,
              fontWeight: 700,
              fontSize: 48,
              color: palette.navy,
              margin: "8px 0 20px",
            }}
          >
            Round 1: Science!
          </h2>
          <p
            style={{
              fontFamily: fonts.body,
              fontSize: 19,
              color: palette.navySoft,
              lineHeight: 1.5,
            }}
          >
            6 questions. 2 lives. Your timer starts when you tap play.
          </p>
          <div style={{ marginTop: 20 }}>
            <PopButton variant="coral" size="lg">
              ▶ Play Round 1
            </PopButton>
          </div>
        </div>
        <div
          style={{
            background: palette.sun,
            border: `4px solid ${palette.navy}`,
            borderRadius: 24,
            boxShadow: shadows.popLg,
            padding: 24,
          }}
        >
          <p
            style={{
              fontFamily: fonts.display,
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: 2,
              color: palette.navy,
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Your hearts
          </p>
          <div style={{ marginTop: 16, fontSize: 56 }}>❤️ ❤️</div>
          <p
            style={{
              fontFamily: fonts.body,
              fontSize: 16,
              color: palette.navy,
              marginTop: 14,
            }}
          >
            Lose them and you&rsquo;re out!
          </p>
        </div>
      </div>
    </StagePad>
  );
};

const PageBracket: React.FC = () => {
  return (
    <StagePad>
      <h1
        style={{
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 64,
          color: palette.navy,
          margin: "0 0 26px",
        }}
      >
        🏆 The bracket
      </h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 30,
          alignItems: "center",
        }}
      >
        {[
          ["Mia", "Sam"],
          ["Rhonda", "Manou"],
          ["Patou", "Marc"],
          ["Sylvie", "David"],
        ].map((m, i) => (
          <BracketSlot key={i} a={m[0]} b={m[1]} />
        ))}
      </div>
      <div
        style={{
          marginTop: 30,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 30,
          alignItems: "center",
        }}
      >
        <BracketSlot a="Quarter 1" b="" muted />
        <BracketSlot a="Quarter 2" b="" muted />
        <BracketSlot a="Semi" b="" muted />
        <div
          style={{
            background: palette.coral,
            color: "white",
            border: `4px solid ${palette.navy}`,
            borderRadius: 24,
            boxShadow: shadows.popLg,
            padding: 22,
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: fonts.display,
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: 2,
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            👑 Champion
          </p>
          <p style={{ fontFamily: fonts.display, fontSize: 32, margin: "10px 0 0" }}>
            ?
          </p>
        </div>
      </div>
    </StagePad>
  );
};

const BracketSlot: React.FC<{ a: string; b: string; muted?: boolean }> = ({
  a,
  b,
  muted = false,
}) => {
  return (
    <div
      style={{
        background: muted ? "rgba(255,255,255,0.55)" : "white",
        border: `3px solid ${palette.navy}`,
        borderRadius: 18,
        boxShadow: shadows.pop,
        padding: 16,
      }}
    >
      <div
        style={{
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 22,
          color: palette.navy,
          padding: "8px 0",
          borderBottom: `2px dashed ${palette.navy}`,
        }}
      >
        {a || "—"}
      </div>
      <div
        style={{
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 22,
          color: palette.navy,
          padding: "8px 0",
        }}
      >
        {b || "—"}
      </div>
    </div>
  );
};

const PagePlayers: React.FC = () => {
  const players = [
    { name: "Mia", icon: "🌞", in: true },
    { name: "Sam", icon: "🦊", in: true },
    { name: "Rhonda", icon: "🌸", in: true },
    { name: "Manou", icon: "✨", in: true },
    { name: "Marc", icon: "🚀", in: true },
    { name: "Patou", icon: "🐢", in: true },
    { name: "Sylvie", icon: "🦋", in: true },
    { name: "David", icon: "🐻", in: false },
  ];
  return (
    <StagePad>
      <h1
        style={{
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 64,
          color: palette.navy,
          margin: "0 0 20px",
        }}
      >
        👥 Players
      </h1>
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 20 }}
      >
        {players.map((p) => (
          <div
            key={p.name}
            style={{
              background: p.in ? "white" : "rgba(255,255,255,0.5)",
              border: `3px solid ${palette.navy}`,
              borderRadius: 18,
              boxShadow: shadows.pop,
              padding: 18,
              display: "flex",
              alignItems: "center",
              gap: 14,
              opacity: p.in ? 1 : 0.6,
            }}
          >
            <div
              style={{
                fontSize: 40,
                width: 60,
                height: 60,
                background: palette.sun,
                border: `3px solid ${palette.navy}`,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {p.icon}
            </div>
            <div>
              <div
                style={{
                  fontFamily: fonts.display,
                  fontWeight: 700,
                  fontSize: 24,
                  color: palette.navy,
                }}
              >
                {p.name}
              </div>
              <div
                style={{
                  fontFamily: fonts.body,
                  fontSize: 14,
                  color: p.in ? palette.grassDeep : palette.coralDeep,
                  marginTop: 2,
                }}
              >
                {p.in ? "still in" : "💔 eliminated"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </StagePad>
  );
};

const PageStandings: React.FC = () => {
  const rows = [
    { name: "Mia", score: 24, hearts: 2 },
    { name: "Rhonda", score: 22, hearts: 2 },
    { name: "Sam", score: 20, hearts: 1 },
    { name: "Manou", score: 18, hearts: 2 },
    { name: "Marc", score: 17, hearts: 1 },
  ];
  return (
    <StagePad>
      <h1
        style={{
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 64,
          color: palette.navy,
          margin: "0 0 26px",
        }}
      >
        📊 Standings
      </h1>
      {rows.map((r, i) => (
        <div
          key={r.name}
          style={{
            background: i === 0 ? palette.sun : "white",
            border: `3px solid ${palette.navy}`,
            borderRadius: 18,
            boxShadow: shadows.pop,
            padding: "16px 22px",
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              background: i === 0 ? palette.coral : palette.sky2,
              border: `3px solid ${palette.navy}`,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: fonts.display,
              fontWeight: 700,
              fontSize: 22,
              color: "white",
            }}
          >
            {i + 1}
          </div>
          <div
            style={{
              fontFamily: fonts.display,
              fontWeight: 700,
              fontSize: 28,
              color: palette.navy,
              flex: 1,
            }}
          >
            {r.name}
          </div>
          <div
            style={{
              fontFamily: fonts.body,
              fontSize: 22,
              color: palette.navySoft,
            }}
          >
            {"❤️".repeat(r.hearts)}
          </div>
          <div
            style={{
              fontFamily: fonts.display,
              fontWeight: 700,
              fontSize: 32,
              color: palette.navy,
              minWidth: 60,
              textAlign: "right",
            }}
          >
            {r.score}
          </div>
        </div>
      ))}
    </StagePad>
  );
};
