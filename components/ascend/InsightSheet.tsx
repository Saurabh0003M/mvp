"use client";

import { motion, AnimatePresence } from "framer-motion";
import { type Insight } from "@/lib/engine";
import { Sparkles, X } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

interface Props {
  insight: Insight | null;
  onApply: () => void;
  onDismiss: () => void;
}

export function InsightSheet({ insight, onApply, onDismiss }: Props) {
  return (
    <AnimatePresence>
      {insight && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onDismiss}
            className="fixed inset-0 z-40 bg-background/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.38, ease: EASE }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-lg rounded-t-[1.75rem] border-t border-border bg-card shadow-lifted"
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-border" />
            <div className="p-6 sm:p-7">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="text-micro text-muted-foreground">AI Insight</div>
                </div>
                <button onClick={onDismiss} className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <h3 className="mt-5 text-balance text-title leading-snug">
                {insight.headline}
              </h3>
              <p className="mt-2.5 text-body text-muted-foreground">{insight.body}</p>

              <div className="mt-5 rounded-xl border border-border bg-background p-4">
                <div className="text-micro text-muted-foreground">Session receipts</div>
                <p className="mt-1.5 text-caption text-foreground/80">{insight.receipts}</p>
              </div>

              <div className="mt-6 flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={onApply}
                  className="flex-1 rounded-full bg-foreground px-5 py-3 text-subtitle text-background shadow-soft transition-all hover:shadow-card"
                >
                  Apply
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={onDismiss}
                  className="rounded-full border border-border px-5 py-3 text-subtitle text-foreground/80 transition-colors hover:bg-accent"
                >
                  Dismiss
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
