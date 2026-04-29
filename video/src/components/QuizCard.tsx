import { palette, fonts, shadows } from "../theme";

// Generic question card used by Question, Replay and Strike scenes.
export const QuizCard: React.FC<{
  questionNumber: number;
  totalQuestions: number;
  prompt: string;
  options: { letter: string; text: string; pickedScore?: number }[];
  picked?: string | null;
}> = ({ questionNumber, totalQuestions, prompt, options, picked }) => {
  return (
    <div
      style={{
        background: "white",
        border: `4px solid ${palette.navy}`,
        borderRadius: 24,
        boxShadow: shadows.popLg,
        padding: "36px 44px",
        width: 1100,
      }}
    >
      <p
        style={{
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: 2,
          color: palette.navySoft,
          textTransform: "uppercase",
          margin: 0,
        }}
      >
        Question {questionNumber} of {totalQuestions}
      </p>
      <h2
        style={{
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 48,
          color: palette.navy,
          margin: "10px 0 24px",
          lineHeight: 1.15,
        }}
      >
        {prompt}
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {options.map((o, i) => {
          const isPicked = picked === o.letter;
          const palettes = [palette.coral, palette.sun, palette.grass, palette.sky2];
          return (
            <div
              key={o.letter}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: isPicked ? palettes[i % palettes.length] : "white",
                color: isPicked && i % 4 !== 1 ? "white" : palette.navy,
                border: `3px solid ${palette.navy}`,
                borderRadius: 14,
                boxShadow: shadows.pop,
                padding: "14px 20px",
                fontFamily: fonts.display,
                fontWeight: 600,
                fontSize: 24,
              }}
            >
              <span style={{ fontSize: 28, fontWeight: 700, marginRight: 4 }}>
                {o.letter}.
              </span>
              <span style={{ flex: 1 }}>{o.text}</span>
              {isPicked ? <span>✓</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
