import { type ReactNode } from "react";
import { PageEnter } from "./PageEnter";

type SpreadProps = {
  left: ReactNode;
  right?: ReactNode;
  pageNumberLeft?: string | number;
  pageNumberRight?: string | number;
};

// The two-page-spread used on desktop. Max width 1080, gutter rule down the
// middle, page numbers in the outer corners. On mobile the right page becomes
// inline asides between sections (a future Aside component). For now mobile
// just stacks left then right with a soft separator.
export function Spread({
  left,
  right,
  pageNumberLeft,
  pageNumberRight,
}: SpreadProps) {
  return (
    <div className="min-h-screen bg-paper-deep flex justify-center">
      <PageEnter>
      <div
        className="
          w-full max-w-[1080px] bg-paper
          mx-0 md:mx-5
          relative
          md:my-7
          md:shadow-[0_0_0_1px_var(--ink)]
        "
      >
        {/* Two-page on desktop */}
        <div className="hidden md:grid md:grid-cols-2 md:gap-0 min-h-[calc(100vh-128px)]">
          <article className="relative px-7 pt-8 pb-9 border-r border-ink">
            <div className="min-h-[calc(100vh-208px)]">{left}</div>
            <div className="absolute left-7 bottom-7">
              {pageNumberLeft ? (
                <span className="font-hand text-caption-md text-ink-muted">
                  {pageNumberLeft}
                </span>
              ) : null}
            </div>
          </article>
          <aside className="relative px-7 pt-8 pb-9 text-ink-muted">
            <div className="min-h-[calc(100vh-208px)]">{right}</div>
            <div className="absolute right-7 bottom-7">
              {pageNumberRight ? (
                <span className="font-hand text-caption-md text-ink-muted">
                  {pageNumberRight}
                </span>
              ) : null}
            </div>
          </aside>
        </div>

        {/* Single page on mobile */}
        <div className="md:hidden px-5 pt-7 pb-8">
          <article>{left}</article>
          {right ? (
            <>
              <div
                className="my-7 text-center text-accent-red"
                aria-hidden="true"
              >
                ✦
              </div>
              <aside className="text-ink-muted">{right}</aside>
            </>
          ) : null}
          <div className="mt-7 text-center">
            {pageNumberLeft ? (
              <span className="font-hand text-caption-md text-ink-muted">
                {pageNumberLeft}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      </PageEnter>
    </div>
  );
}
