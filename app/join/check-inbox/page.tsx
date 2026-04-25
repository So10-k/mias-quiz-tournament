import Link from "next/link";
import { Stage } from "@/components/Stage";

export default function CheckInbox() {
  return (
    <Stage>
      <div className="h-[calc(100vh-128px)] flex items-center justify-center px-4">
        <div className="w-full max-w-xl">
          <div className="card px-7 py-7 text-center">
            <div className="text-6xl bob">📬</div>
            <h1 className="font-display text-4xl md:text-5xl text-navy mt-3">
              Check your inbox!
            </h1>
            <p className="font-display text-xl md:text-2xl text-navy mt-3">
              We sent you a magic link.
              <br />
              Open it on this device to play.
            </p>
            <p className="font-body text-base text-navy-soft mt-5">
              It works once, within twenty-four hours.
            </p>
            <Link href="/" className="pop pop-yellow mt-7 inline-flex">
              ← Home
            </Link>
          </div>
        </div>
      </div>
    </Stage>
  );
}
