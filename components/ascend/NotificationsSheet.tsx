"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, Sparkles, Compass } from "lucide-react";
import { type EngineState, type Insight } from "@/lib/engine";
import { type CompressedCognitiveState, PIVOT_COPY } from "@/lib/cognitive";

interface Props {
  open: boolean;
  onClose: () => void;
  state: EngineState;
  ccs: CompressedCognitiveState | null;
  activeInsight: Insight | null;
  onApplyInsight: () => void;
}

export function NotificationsSheet({
  open,
  onClose,
  state,
  ccs,
  activeInsight,
  onApplyInsight,
}: Props) {
  const applied = state.appliedInsights.size;
  const dismissed = state.dismissedInsights.size;
  const pivotCopy = ccs && ccs.pivot ? PIVOT_COPY[ccs.pivot] : null;
  const hasAnything = activeInsight || pivotCopy || applied + dismissed > 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            data-overlay-open
            role="dialog"
            aria-modal="true"
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-lifted"
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <div>
                <div className="text-micro text-muted-foreground">Signals</div>
                <h2 className="text-headline mt-1">Notifications</h2>
              </div>
              <button onClick={onClose} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {!hasAnything && (
                <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                    <Bell className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="mt-4 max-w-xs text-body text-muted-foreground">
                    Nothing new yet. As you swipe, we&apos;ll flag shifts in your taste and nudges from your patterns here.
                  </p>
                </div>
              )}

              {activeInsight && (
                <div className="rounded-2xl border border-border bg-background p-4 shadow-soft">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-foreground/60" />
                    <span className="text-micro text-muted-foreground">Detected shift</span>
                  </div>
                  <div className="mt-2 text-title leading-tight">{activeInsight.headline}</div>
                  <p className="mt-2 text-caption text-muted-foreground leading-relaxed">{activeInsight.body}</p>
                  {activeInsight.receipts && (
                    <p className="mt-2 text-micro text-muted-foreground">{activeInsight.receipts}</p>
                  )}
                  <button
                    onClick={() => { onApplyInsight(); onClose(); }}
                    className="mt-3 rounded-full bg-foreground px-4 py-1.5 text-caption text-background transition-opacity hover:opacity-90"
                  >
                    Apply
                  </button>
                </div>
              )}

              {pivotCopy && ccs && (
                <div className="rounded-2xl border border-border bg-background p-4 shadow-soft">
                  <div className="flex items-center gap-2">
                    <Compass className="h-4 w-4 text-foreground/60" />
                    <span className="text-micro text-muted-foreground">A nudge from your pattern</span>
                  </div>
                  <div className="mt-2 text-title leading-tight">{pivotCopy.headline}</div>
                  <p className="mt-2 text-caption text-muted-foreground leading-relaxed">{pivotCopy.body}</p>
                </div>
              )}

              {(applied > 0 || dismissed > 0) && (
                <div className="rounded-2xl border border-border bg-background p-4">
                  <div className="text-micro text-muted-foreground">History</div>
                  <div className="mt-2 flex gap-6 text-caption">
                    <div>
                      <span className="text-foreground font-semibold tabular-nums">{applied}</span>
                      <span className="ml-1 text-muted-foreground">applied</span>
                    </div>
                    <div>
                      <span className="text-foreground font-semibold tabular-nums">{dismissed}</span>
                      <span className="ml-1 text-muted-foreground">dismissed</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
