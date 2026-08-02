"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Compass } from "lucide-react";
import { PIVOT_COPY, type CompressedCognitiveState } from "@/lib/cognitive";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The one corrective posture the cognitive layer has chosen, if any. At most
 * one is ever active — an agent that nudges on four axes at once is just noise.
 */
export function PivotBanner({
  ccs,
  className,
  compact = false,
}: {
  ccs: CompressedCognitiveState | null;
  className?: string;
  compact?: boolean;
}) {
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
          className={cn(
            "mt-5 rounded-2xl border border-border bg-sunfade shadow-soft",
            compact ? "p-3.5" : "p-4",
            className
          )}
        >
          <div className={cn("flex", compact ? "gap-3" : "gap-3.5")}>
            <div
              className={cn(
                "mt-0.5 flex shrink-0 items-center justify-center rounded-xl bg-foreground text-background",
                compact ? "h-8 w-8" : "h-9 w-9"
              )}
            >
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <div className="text-micro text-muted-foreground">A nudge from your pattern</div>
              <div className={cn("mt-0.5", compact ? "text-subtitle leading-snug" : "text-title")}>
                {copy.headline}
              </div>
              {!compact && (
                <p className="mt-1.5 text-caption leading-relaxed text-muted-foreground">
                  {copy.body}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
