"use client";

import { motion, AnimatePresence } from "framer-motion";
import { type EngineState, type Recommendation, CATEGORY_ACCENTS, FORMAT_LABELS } from "@/lib/engine";
import { X, Check, Clock, Signal, Bookmark } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

interface ShelfProps {
  open: boolean;
  onClose: () => void;
  state: EngineState;
  onResurface?: (id: string) => void;
  mode: "accepted" | "later";
}

export function QuestsShelf({ open, onClose, state, onResurface, mode }: ShelfProps) {
  const items = mode === "accepted" ? state.accepted : state.later;
  const title = mode === "accepted" ? "Today's Quests" : "Maybe Later";
  const emptyText =
    mode === "accepted"
      ? "No quests yet. Swipe right on a recommendation to add it here."
      : "Nothing parked. Swipe down on a card to save it for later.";

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
            transition={{ duration: 0.35, ease: EASE }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-lifted"
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <div>
                <div className="text-micro text-muted-foreground">{mode === "accepted" ? "Accepted" : "Parked"}</div>
                <h2 className="text-headline mt-1">{title}</h2>
              </div>
              <button onClick={onClose} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                    {mode === "accepted" ? <Check className="h-6 w-6 text-muted-foreground" /> : <Bookmark className="h-6 w-6 text-muted-foreground" />}
                  </div>
                  <p className="mt-4 max-w-xs text-body text-muted-foreground">{emptyText}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((card, i) => (
                    <ShelfCard key={card.id} card={card} index={i} onResurface={onResurface} mode={mode} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ShelfCard({
  card,
  index,
  onResurface,
  mode,
}: {
  card: Recommendation;
  index: number;
  onResurface?: (id: string) => void;
  mode: "accepted" | "later";
}) {
  const accent = CATEGORY_ACCENTS[card.category];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE, delay: index * 0.04 }}
      className="overflow-hidden rounded-2xl border border-border bg-background shadow-soft"
    >
      <div className="h-1 w-full" style={{ background: accent }} />
      <div className="p-4">
        <div className="flex items-center justify-between">
          <span className="rounded-full px-2.5 py-0.5 text-micro" style={{ background: `hsl(from ${accent} h s l / 0.1)`, color: accent }}>
            {card.category}
          </span>
          <div className="flex items-center gap-2.5 text-caption text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{card.duration}m</span>
            <span className="flex items-center gap-1"><Signal className="h-3 w-3" />{card.difficulty}</span>
          </div>
        </div>
        <h3 className="mt-3 text-subtitle leading-tight">{card.title}</h3>
        <p className="mt-1.5 text-caption text-muted-foreground line-clamp-2">{card.description}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-caption text-muted-foreground">{FORMAT_LABELS[card.format]}</span>
          {mode === "later" && onResurface && (
            <button
              onClick={() => onResurface(card.id)}
              className="rounded-full border border-border px-3 py-1 text-caption text-foreground/80 transition-colors hover:bg-accent"
            >
              Resurface
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
