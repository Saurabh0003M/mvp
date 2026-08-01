"use client";

import { motion, AnimatePresence } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

interface Props {
  message: string | null;
}

export function Toast({ message }: Props) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="fixed bottom-8 left-1/2 z-[60] -translate-x-1/2"
        >
          <div className="flex items-center gap-2.5 rounded-full bg-foreground px-5 py-3 text-body text-background shadow-lifted">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
