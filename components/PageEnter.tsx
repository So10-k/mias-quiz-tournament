"use client";

import { motion } from "framer-motion";
import { type ReactNode } from "react";

// Page-enter cross-fade: 280ms with a 4px upward translate.
export function PageEnter({ children }: { children: ReactNode }) {
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
