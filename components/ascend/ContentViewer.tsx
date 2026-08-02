"use client";

// ============================================================================
// The payoff. "What happens after I say yes?"
// ----------------------------------------------------------------------------
// Accepting a card used to just move it to a shelf — the card was a promise
// with nothing behind it. Now accept OPENS THE MEDIA, in place, by kind:
// video and music play in an embedded player, podcasts in an audio element,
// articles open a reader, a practice becomes a do-it-now checklist, and a
// mentor becomes a person you can book. One curator, many media — which is
// what "media, knowledge and experiences" actually requires.
//
// Nothing here re-hosts anyone's content: video/music render the rightsholder's
// own embed, and articles link out to the source. We supply curation, not copies.
// ============================================================================

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  type Recommendation,
  CATEGORY_ACCENTS,
  MEDIA_KIND_LABELS,
  resolveMediaKind,
} from "@/lib/engine";
import { X, ExternalLink, Check, Clock, Sparkles } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

interface Props {
  card: Recommendation | null;
  onClose: () => void;
  onComplete: (card: Recommendation) => void;
}

export function ContentViewer({ card, onClose, onComplete }: Props) {
  const [done, setDone] = useState(false);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (card) {
      setDone(false);
      setChecked({});
    }
  }, [card]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (card) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, onClose]);

  if (!card) return null;
  const kind = resolveMediaKind(card);
  const accent = CATEGORY_ACCENTS[card.category];

  return (
    <AnimatePresence>
      {card && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-background/70 backdrop-blur-md"
          />
          <div className="pointer-events-none fixed inset-0 z-[61] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.35, ease: EASE }}
            role="dialog"
            aria-modal="true"
            data-overlay-open
            // Centred by the flex wrapper below, NOT by -translate-*: Framer
            // Motion writes an inline `transform` for y/scale which overrides
            // Tailwind's translate utilities, which left the panel anchored at
            // the viewport centre and overflowing off-screen.
            className="pointer-events-auto flex max-h-[88vh] w-[calc(100%-2rem)] max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-lifted"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-micro"
                    style={{ background: `hsl(from ${accent} h s l / 0.12)`, color: accent }}
                  >
                    {MEDIA_KIND_LABELS[kind]}
                  </span>
                  <span className="text-micro text-muted-foreground">{card.category}</span>
                </div>
                <h2 className="mt-1.5 truncate text-title leading-tight">{card.title}</h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body — one branch per media kind */}
            <div className="flex-1 overflow-y-auto">
              {(kind === "video" || kind === "music") && card.embedUrl && (
                <div className="aspect-video w-full bg-black">
                  <iframe
                    src={card.embedUrl}
                    title={card.title}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}

              {kind === "podcast" && card.embedUrl && (
                <div className="px-5 py-6">
                  <audio controls src={card.embedUrl} className="w-full">
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}

              {kind === "mentor" && card.mentor && (
                <div className="px-5 py-6">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-subtitle text-background"
                      style={{ background: accent }}
                    >
                      {card.mentor.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-subtitle">{card.mentor.name}</div>
                      <div className="text-caption text-muted-foreground">{card.mentor.role}</div>
                    </div>
                  </div>
                </div>
              )}

              {kind === "practice" && (
                <div className="px-5 py-5">
                  <div className="text-micro text-muted-foreground">Do this now</div>
                  <ul className="mt-3 space-y-2">
                    {(card.steps ?? ["Set a timer.", "Do the thing.", "Note one sentence about how it went."]).map(
                      (step, i) => (
                        <li key={i}>
                          <button
                            onClick={() => setChecked((c) => ({ ...c, [i]: !c[i] }))}
                            className="flex w-full items-start gap-3 rounded-xl border border-border bg-background p-3 text-left transition-colors hover:bg-accent"
                          >
                            <span
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                checked[i]
                                  ? "border-foreground bg-foreground text-background"
                                  : "border-border"
                              }`}
                            >
                              {checked[i] && <Check className="h-3 w-3" />}
                            </span>
                            <span
                              className={`text-body ${
                                checked[i] ? "text-muted-foreground line-through" : "text-foreground"
                              }`}
                            >
                              {step}
                            </span>
                          </button>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}

              {/* Description always shows — it's the context for whatever played */}
              <div className="px-5 pb-5 pt-4">
                <p className="text-body text-muted-foreground">{card.description}</p>
                <div className="mt-3 flex items-center gap-3 text-caption text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {card.duration} min
                  </span>
                  <span>{card.difficulty}</span>
                </div>
                {card.embedUrl && kind === "article" && (
                  <a
                    href={card.embedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-caption transition-colors hover:bg-accent"
                  >
                    Open at source
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Footer — completion is the strongest signal we can collect */}
            <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
              <span className="text-caption text-muted-foreground">
                {done ? "Logged. That shapes what comes next." : "Finished it?"}
              </span>
              <button
                onClick={() => {
                  setDone(true);
                  onComplete(card);
                  window.setTimeout(onClose, 900);
                }}
                disabled={done}
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-caption text-background transition-opacity disabled:opacity-60"
              >
                {done ? <Sparkles className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                {done ? "Nice" : "Mark done"}
              </button>
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
