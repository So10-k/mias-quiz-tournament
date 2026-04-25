import { type ReactNode } from "react";
import { SkyBackground } from "./scene/SkyBackground";
import { Nav } from "./Nav";

type Props = {
  children: ReactNode;
  // When true, content is allowed to scroll inside its own card if needed.
  // When false (default), the page is sized to fill the viewport without
  // body-level scrolling — picture-book pages.
  scrollable?: boolean;
};

export function Stage({ children, scrollable = false }: Props) {
  return (
    <>
      <SkyBackground />
      <div className="relative z-10 min-h-screen flex flex-col">
        <Nav />
        <main
          className={
            "relative z-10 flex-1 px-4 md:px-7 pt-4 pb-7 " +
            (scrollable ? "overflow-y-auto" : "overflow-hidden")
          }
        >
          {children}
        </main>
      </div>
    </>
  );
}
