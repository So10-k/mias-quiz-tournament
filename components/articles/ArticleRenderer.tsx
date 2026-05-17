// Renders a validated ArticleBlock[] into picture-book themed React.
//
// Server component (no client interactivity) so it can be used inside
// any RSC tree. Inline markdown in paragraphs is parsed cheaply with
// regexes — we only support **bold**, _italic_, `code`, and
// [link](url). Anything more would need a real markdown library.

import Link from "next/link";
import type { ArticleBlock } from "@/lib/article-blocks";

export function ArticleRenderer({ blocks }: { blocks: ArticleBlock[] }) {
  return (
    <div className="flex flex-col gap-5">
      {blocks.map((b) => (
        <BlockView key={b.id} block={b} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case "heading": {
      const Tag = block.data.level === 2 ? "h2" : "h3";
      const cls =
        block.data.level === 2
          ? "font-display text-3xl md:text-4xl text-navy mt-2"
          : "font-display text-xl md:text-2xl text-navy mt-1";
      return <Tag className={cls}>{block.data.text}</Tag>;
    }
    case "paragraph":
      return (
        <p className="font-body text-lg text-navy leading-relaxed">
          <InlineMarkdown text={block.data.text} />
        </p>
      );
    case "image":
      return (
        <figure className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.data.src}
            alt={block.data.alt}
            className="w-full rounded-2xl border-4 border-navy shadow-pop-sm"
          />
          {block.data.caption ? (
            <figcaption className="font-body text-sm text-navy-soft text-center italic">
              {block.data.caption}
            </figcaption>
          ) : null}
        </figure>
      );
    case "callout": {
      const tone = block.data.tone;
      // Callouts hold paragraph-length copy, so we swap to soft pastel
      // bg + navy text (much higher contrast than white-on-coral). The
      // original strong coral/grass tones are still available on
      // CTA-style elements like buttons where text is short.
      const bg =
        tone === "coral"
          ? "bg-coral-soft text-navy"
          : tone === "sun"
            ? "bg-sun text-navy"
            : tone === "sky"
              ? "bg-sky1 text-navy"
              : "bg-grass-soft text-navy";
      return (
        <div
          className={`card px-5 py-4 flex gap-3 items-start ${bg}`}
          style={{ boxShadow: "5px 5px 0 0 var(--navy)" }}
        >
          {block.data.emoji ? (
            <span className="text-3xl shrink-0">{block.data.emoji}</span>
          ) : null}
          <p className="font-body text-base leading-relaxed flex-1">
            <InlineMarkdown text={block.data.text} />
          </p>
        </div>
      );
    }
    case "quote":
      return (
        <blockquote className="border-l-4 border-coral-deep pl-5 py-2 my-2">
          <p className="font-display text-2xl md:text-3xl text-navy italic leading-snug">
            “{block.data.text}”
          </p>
          {block.data.attribution ? (
            <footer className="font-body text-base text-navy-soft mt-2">
              — {block.data.attribution}
            </footer>
          ) : null}
        </blockquote>
      );
    case "divider": {
      const ornament =
        block.data.variant === "stars"
          ? "✦ ✧ ✦"
          : block.data.variant === "sun"
            ? "✿ ✿ ✿"
            : "～～～";
      return (
        <div className="font-display text-2xl text-navy text-center my-3 select-none">
          {ornament}
        </div>
      );
    }
    case "button": {
      const cls = `pop pop-${block.data.tone} text-base inline-flex self-start`;
      const isExternal = /^https?:\/\//.test(block.data.href);
      return isExternal ? (
        <a
          href={block.data.href}
          target="_blank"
          rel="noopener noreferrer"
          className={cls}
        >
          {block.data.text} →
        </a>
      ) : (
        <Link href={block.data.href} className={cls}>
          {block.data.text} →
        </Link>
      );
    }
    case "list": {
      const Tag = block.data.ordered ? "ol" : "ul";
      const cls = block.data.ordered
        ? "list-decimal list-outside ml-6 flex flex-col gap-2"
        : "list-disc list-outside ml-6 flex flex-col gap-2";
      return (
        <Tag className={cls}>
          {block.data.items.map((item, i) => (
            <li
              key={i}
              className="font-body text-lg text-navy leading-relaxed"
            >
              <InlineMarkdown text={item} />
            </li>
          ))}
        </Tag>
      );
    }
  }
}

// Small inline parser. Order matters: links first (they contain other
// chars), then bold, then italic, then code.
function InlineMarkdown({ text }: { text: string }) {
  const tokens = tokenize(text);
  return (
    <>
      {tokens.map((t, i) => {
        switch (t.kind) {
          case "text":
            return <span key={i}>{t.value}</span>;
          case "bold":
            return <strong key={i}>{t.value}</strong>;
          case "italic":
            return <em key={i}>{t.value}</em>;
          case "code":
            return (
              <code
                key={i}
                className="bg-white border-2 border-navy rounded px-1 text-sm font-mono"
              >
                {t.value}
              </code>
            );
          case "link":
            return (
              <a
                key={i}
                href={t.href}
                className="text-coral-deep underline"
                target={/^https?:\/\//.test(t.href) ? "_blank" : undefined}
                rel="noopener noreferrer"
              >
                {t.value}
              </a>
            );
        }
      })}
    </>
  );
}

type Token =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string }
  | { kind: "code"; value: string }
  | { kind: "link"; value: string; href: string };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  // Greedy single-pass scanner. Each match consumes its delimiters and
  // emits the matched span as its own token; everything else is plain
  // text accumulated into a buffer that flushes on every match.
  const patterns: { kind: Token["kind"]; re: RegExp }[] = [
    { kind: "link", re: /^\[([^\]]+)\]\(([^)\s]+)\)/ },
    { kind: "bold", re: /^\*\*([^*]+)\*\*/ },
    { kind: "italic", re: /^_([^_]+)_/ },
    { kind: "code", re: /^`([^`]+)`/ },
  ];
  let buf = "";
  const flush = () => {
    if (buf) {
      tokens.push({ kind: "text", value: buf });
      buf = "";
    }
  };
  while (i < input.length) {
    const tail = input.slice(i);
    let matched = false;
    for (const p of patterns) {
      const m = tail.match(p.re);
      if (!m) continue;
      flush();
      if (p.kind === "link") {
        tokens.push({ kind: "link", value: m[1], href: m[2] });
      } else {
        tokens.push({ kind: p.kind, value: m[1] });
      }
      i += m[0].length;
      matched = true;
      break;
    }
    if (!matched) {
      buf += input[i];
      i++;
    }
  }
  flush();
  return tokens;
}
