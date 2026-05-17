// Embed-mode standings. Bare table of the current tournament cast +
// elimination status. Used by the [quizbook-standings] shortcode.

import Link from "next/link";
import {
  getActiveTournament,
  getLatestTournament,
  getCast,
} from "@/lib/engine";

export const dynamic = "force-dynamic";

export default async function EmbedStandingsPage() {
  const tournament =
    (await getActiveTournament()) ?? (await getLatestTournament());
  if (!tournament) {
    return (
      <div style={{ padding: "1.5rem", textAlign: "center" }}>
        <p>No active tournament.</p>
      </div>
    );
  }
  const cast = await getCast(tournament.id);
  const stillIn = cast.filter((c) => !c.enrollment.eliminatedAt);
  const out = cast.filter((c) => c.enrollment.eliminatedAt);

  return (
    <div style={{ padding: "12px 16px" }}>
      <p
        style={{
          fontFamily: "Fredoka, sans-serif",
          fontSize: "11px",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "#E94B7E",
          margin: "0 0 8px",
        }}
      >
        Standings · {stillIn.length} still in
      </p>
      <div
        style={{
          background: "#FFFFFF",
          border: "4px solid #1B2A4E",
          borderRadius: "20px",
          boxShadow: "6px 6px 0 0 #1B2A4E",
          padding: "14px 16px",
        }}
      >
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {stillIn.map((c) => (
            <li
              key={c.user.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 0",
                borderBottom: "2px dotted rgba(27,42,78,0.15)",
                fontFamily: "Fredoka, sans-serif",
                fontWeight: 700,
                color: "#1B2A4E",
              }}
            >
              <span>✓</span>
              <span style={{ flex: 1 }}>{c.user.name ?? "—"}</span>
              <span
                style={{
                  fontSize: "11px",
                  background: "#7DD87D",
                  color: "#1B2A4E",
                  padding: "2px 8px",
                  border: "2px solid #1B2A4E",
                  borderRadius: "999px",
                }}
              >
                still in
              </span>
            </li>
          ))}
          {out.map((c) => (
            <li
              key={c.user.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 0",
                fontFamily: "Quicksand, sans-serif",
                color: "rgba(27,42,78,0.55)",
                textDecoration: "line-through",
              }}
            >
              <span>—</span>
              <span style={{ flex: 1 }}>{c.user.name ?? "—"}</span>
            </li>
          ))}
        </ul>
      </div>
      <p
        style={{
          marginTop: 10,
          fontSize: 11,
          textAlign: "right",
          opacity: 0.7,
        }}
      >
        <Link
          href="https://quiz.miaswebsites.art/standings"
          target="_top"
          style={{ color: "#3B4A7E" }}
        >
          Full standings →
        </Link>
      </p>
    </div>
  );
}
