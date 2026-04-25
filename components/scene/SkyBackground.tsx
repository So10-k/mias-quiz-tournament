import { Cloud } from "./Cloud";
import { Sun } from "./Sun";
import { Hill } from "./Hill";

// A full-bleed sunny scene. Renders the gradient itself so it doesn't sit
// behind the body's background (which can hide negative-z-index children).
// Clouds and the hill stack on top of the gradient inside this same fixed
// container; the page's main content wrapper carries z-10 to sit above.
export function SkyBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* base sky gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, var(--sky-1) 0%, var(--sky-2) 60%, var(--sky-3) 100%)",
        }}
      />

      {/* Sun, top-right, well below the nav */}
      <div
        className="absolute right-7 spin-slow"
        style={{ top: "108px" }}
      >
        <Sun size={150} />
      </div>

      {/* Drifting clouds at varying altitudes & speeds */}
      <div
        className="absolute left-0 w-full drift-slow"
        style={{ top: "130px" }}
      >
        <Cloud size={150} />
      </div>
      <div
        className="absolute left-0 w-full drift-mid"
        style={{ top: "230px" }}
      >
        <div style={{ marginLeft: "32%" }}>
          <Cloud size={110} />
        </div>
      </div>
      <div
        className="absolute left-0 w-full drift-fast"
        style={{ top: "320px" }}
      >
        <div style={{ marginLeft: "65%" }}>
          <Cloud size={85} />
        </div>
      </div>

      <Hill />
    </div>
  );
}
