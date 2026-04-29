import Link from "next/link";

// Page-header block: chunky uppercase hero with chromatic stroke + a
// subtle scanline; row of pill-style nav buttons underneath.

export function ArcadeTitle({
  eyebrow,
  title,
  subtitle,
  links,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  links?: Array<{ href: string; label: string; active?: boolean }>;
}) {
  return (
    <div className="text-center pt-12 pb-6 px-4 relative">
      <style>{`
        .arcade-hero {
          font-family: "Fredoka", "Quicksand", system-ui, sans-serif;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          font-size: clamp(40px, 8vw, 96px);
          line-height: 0.95;
          background: linear-gradient(180deg, #FFFFFF 0%, #FFCC00 45%, #FFA500 65%, #FF6B00 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          -webkit-text-stroke: 2px #1B0440;
          filter: drop-shadow(0 4px 0 rgba(0,0,0,0.6)) drop-shadow(0 0 12px rgba(255,204,0,0.45));
          margin: 0;
        }
        .arcade-eyebrow {
          font-family: "Fredoka", "Quicksand", system-ui, sans-serif;
          font-weight: 700;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          font-size: 14px;
          color: #00F0FF;
          text-shadow: 0 0 16px rgba(0,240,255,0.6);
          margin: 0 0 8px;
        }
        .arcade-sub {
          font-family: "Quicksand", system-ui, sans-serif;
          font-weight: 600;
          font-size: clamp(15px, 2.2vw, 19px);
          color: rgba(244,236,255,0.78);
          margin-top: 14px;
        }
        .arcade-nav {
          display: inline-flex; gap: 10px; flex-wrap: wrap; justify-content: center;
          margin-top: 22px;
        }
        .arcade-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 18px;
          font-family: "Fredoka", "Quicksand", system-ui, sans-serif;
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #F4ECFF;
          background: linear-gradient(180deg, rgba(35,12,80,0.95) 0%, rgba(20,7,50,0.95) 100%);
          border: 2px solid rgba(178,58,255,0.55);
          border-radius: 999px;
          text-decoration: none;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.5) inset;
          transition: transform .12s ease, border-color .12s ease, color .12s ease;
        }
        .arcade-pill:hover {
          transform: translateY(-1px);
          border-color: #00F0FF;
          color: #00F0FF;
        }
        .arcade-pill.active {
          background: linear-gradient(180deg, #FFCC00 0%, #FF8800 100%);
          color: #1B0440;
          border-color: #FFCC00;
          box-shadow: 0 4px 16px rgba(255,204,0,0.4);
        }
      `}</style>
      {eyebrow ? <p className="arcade-eyebrow">{eyebrow}</p> : null}
      <h1 className="arcade-hero">{title}</h1>
      {subtitle ? <p className="arcade-sub">{subtitle}</p> : null}
      {links && links.length > 0 ? (
        <div className="arcade-nav">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={"arcade-pill " + (l.active ? "active" : "")}
            >
              {l.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
