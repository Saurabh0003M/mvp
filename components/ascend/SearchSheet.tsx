"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Clock, Signal } from "lucide-react";
import {
  type Recommendation,
  LIVE_CORPUS,
  CATEGORY_ACCENTS,
  FORMAT_LABELS,
} from "@/lib/engine";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SearchSheet({ open, onClose }: Props) {
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return LIVE_CORPUS.filter((r) => {
      const hay =
        r.title.toLowerCase() +
        " " +
        r.description.toLowerCase() +
        " " +
        r.category.toLowerCase() +
        " " +
        r.tags.join(" ").toLowerCase();
      return hay.includes(query);
    }).slice(0, 20);
  }, [q]);

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
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            data-overlay-open
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-6 z-50 flex max-h-[80vh] w-full max-w-lg -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lifted"
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && onClose()}
                placeholder="Search quests, topics, tags…"
                className="flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground/60"
              />
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {!q.trim() && (
                <div className="px-4 py-8 text-center text-caption text-muted-foreground">
                  Type to search across {LIVE_CORPUS.length} quests.
                </div>
              )}
              {q.trim() && results.length === 0 && (
                <div className="px-4 py-8 text-center text-caption text-muted-foreground">
                  No matches for &ldquo;{q}&rdquo;.
                </div>
              )}
              {results.length > 0 && (
                <ul className="space-y-2">
                  {results.map((r) => (
                    <li key={r.id}>
                      <SearchResult card={r} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SearchResult({ card }: { card: Recommendation }) {
  const accent = CATEGORY_ACCENTS[card.category];
  return (
    <div className="rounded-xl border border-border bg-background p-3 transition-colors hover:bg-accent/40">
      <div className="flex items-center justify-between">
        <span
          className="rounded-full px-2 py-0.5 text-micro"
          style={{ background: `hsl(from ${accent} h s l / 0.1)`, color: accent }}
        >
          {card.category}
        </span>
        <div className="flex items-center gap-2.5 text-caption text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{card.duration}m</span>
          <span className="flex items-center gap-1"><Signal className="h-3 w-3" />{card.difficulty}</span>
        </div>
      </div>
      <div className="mt-1.5 text-subtitle leading-tight">{card.title}</div>
      <div className="mt-1 text-caption text-muted-foreground line-clamp-2">{card.description}</div>
      <div className="mt-1.5 text-micro text-muted-foreground">{FORMAT_LABELS[card.format]}</div>
    </div>
  );
}
