"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Compass } from "lucide-react";
import { PIVOT_COPY, type CompressedCognitiveState } from "@/lib/cognitive";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The one corrective posture the cognitive layer has chosen, if any. At most
 * one is ever active — an agent that nudges on four axes at once is just noise.
 */
export function PivotBanner({ ccs }: { ccs: CompressedCognitiveState | null }) {
  const copy = ccs ? PIVOT_COPY[ccs.pivot] : null;

  return (
    <AnimatePresence mode="wait">
      {copy && ccs && (
        <motion.div
          key={ccs.pivot}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-soft"
        >
          <div className="flex gap-3.5">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <div className="text-micro text-muted-foreground">A nudge from your pattern</div>
              <div className="text-subtitle mt-0.5">{copy.headline}</div>
              <p className="mt-1.5 text-caption leading-relaxed text-muted-foreground">
                {copy.body}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
