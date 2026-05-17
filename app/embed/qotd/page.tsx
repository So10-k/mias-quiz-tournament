// Embed-mode Question of the Day. Picture-book card with the day's
// prompt + 4 options. Read-only — answering still happens on the
// main site. Used by the [quizbook-qotd] shortcode in Discourse.

import Link from "next/link";
import { getTodayQuestion } from "@/lib/qotd";

export const dynamic = "force-dynamic";

export default async function EmbedQotdPage() {
  const q = await getTodayQuestion();
  if (!q) {
    return (
      <div style={{ padding: "1.5rem", textAlign: "center" }}>
        <p>💡 No question of the day yet.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 16px" }}>
      <a
        href="https://quiz.miaswebsites.art/qotd"
        target="_top"
        style={{
          display: "block",
          textDecoration: "none",
          padding: "20px 22px",
          borderRadius: "22px",
          border: "4px solid #1B2A4E",
          boxShadow: "8px 8px 0 0 #1B2A4E",
          background:
            "linear-gradient(135deg, #FFE873 0%, #FFD93D 60%, #FFC100 100%)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "Fredoka, sans-serif",
            fontWeight: 700,
            fontSize: "11px",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#E94B7E",
          }}
        >
          💡 Question of the Day
        </p>
        <p
          style={{
            margin: "8px 0 0",
            fontFamily: "Fredoka, sans-serif",
            fontWeight: 700,
            fontSize: "22px",
            color: "#1B2A4E",
            lineHeight: 1.2,
          }}
        >
          {q.prompt}
        </p>
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          {q.options.map((o) => (
            <span
              key={o.value}
              style={{
                background: "#FFFFFF",
                border: "3px solid #1B2A4E",
                borderRadius: "10px",
                boxShadow: "2px 2px 0 0 #1B2A4E",
                padding: "8px 10px",
                fontFamily: "Fredoka, sans-serif",
                fontWeight: 700,
                fontSize: "13px",
                color: "#1B2A4E",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              <span style={{ color: "#E94B7E", marginRight: 6 }}>{o.value}.</span>
              {o.label}
            </span>
          ))}
        </div>
        <p
          style={{
            margin: "10px 0 0",
            fontFamily: "Quicksand, sans-serif",
            fontSize: "11px",
            textAlign: "right",
            color: "#1B2A4E",
          }}
        >
          Tap to answer →
        </p>
      </a>
    </div>
  );
}
