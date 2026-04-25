"use client";

import { motion } from "framer-motion";
import { type ReactNode } from "react";
import { Inkblot } from "./ink/Inkblot";
import { EndStamp } from "./ink/Stamp";

type Props = {
  variant: "struck" | "eliminated" | "passed" | null;
  children?: ReactNode;
};

// One-shot animation that plays after a chapter submission.
export function StrikeReveal({ variant, children }: Props) {
  if (!variant) return <>{children}</>;

  if (variant === "passed") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.2, 0.8, 0.3, 1] }}
      >
        {children}
      </motion.div>
    );
  }

  if (variant === "struck") {
    return (
      <motion.div
        animate={{ x: [0, -3, 3, -2, 2, 0] }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="relative"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.32, ease: [0.2, 0.8, 0.3, 1] }}
          className="flex items-center gap-3 mb-5 text-accent-red"
        >
          <Inkblot size={48} className="text-accent-red" />
          <span className="font-hand text-caption-md">
            One inkblot on your page. Take care.
          </span>
        </motion.div>
        {children}
      </motion.div>
    );
  }

  // eliminated
  return (
    <motion.div className="relative">
      <motion.div
        initial={{ opacity: 0, scale: 1.4, rotate: -2 }}
        animate={{ opacity: 1, scale: 1, rotate: -6 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="text-accent-red mb-5"
      >
        <EndStamp size={240} className="text-accent-red" />
      </motion.div>
      <p className="font-reading italic text-body-lead text-ink-muted mb-7">
        The story ends here for you, brave reader. You may return as a witness.
      </p>
      {children}
    </motion.div>
  );
}
