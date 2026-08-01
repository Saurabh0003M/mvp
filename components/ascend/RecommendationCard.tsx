"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  type Recommendation,
  type EngineState,
  type UserProfile,
  CATEGORY_ACCENTS,
  FORMAT_LABELS,
  whyThis,
} from "@/lib/engine";
import { ChevronDown, Clock, Signal } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

interface Props {
  card: Recommendation;
  state: EngineState;
  profile: UserProfile;
  dragX: number;
  dragY: number;
  isTop: boolean;
  onExpandWhy: () => void;
}

export function RecommendationCard({
  card,
  state,
  profile,
  dragX,
  dragY,
  isTop,
  onExpandWhy,
}: Props) {
  const [whyOpen, setWhyOpen] = useState(false);
  const accent = CATEGORY_ACCENTS[card.category];

  const horizontalDrag = Math.abs(dragX) > Math.abs(dragY);
  const isRight = dragX > 40;
  const isLeft = dragX < -40;
  const isDown = dragY > 40 && !horizontalDrag;

  const overlayOpacity = Math.min(
    (Math.abs(dragX) + (horizontalDrag ? 0 : Math.abs(dragY))) / 120,
    0.85
  );

  return (
    <div className="relative h-full w-full select-none">
      {/* Direction accent glow */}
      {isTop && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[1.75rem]"
          animate={{
            opacity: isRight || isLeft || isDown ? overlayOpacity : 0,
            boxShadow: isRight
              ? `inset 0 0 0 3px hsl(var(--success)), 0 0 60px hsl(var(--success) / 0.25)`
              : isLeft
              ? `inset 0 0 0 3px hsl(var(--danger)), 0 0 60px hsl(var(--danger) / 0.25)`
              : isDown
              ? `inset 0 0 0 3px hsl(var(--warning)), 0 0 60px hsl(var(--warning) / 0.25)`
              : "none",
          }}
          transition={{ duration: 0.15 }}
        />
      )}

      <div className="flex h-full w-full flex-col overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-card">
        {/* Accent top line */}
        <div className="h-1.5 w-full" style={{ background: accent }} />

        <div className="flex flex-1 flex-col p-7 sm:p-8">
          {/* Meta row */}
          <div className="flex items-center justify-between">
            <span
              className="rounded-full px-3 py-1 text-micro"
              style={{ background: `hsl(from ${accent} h s l / 0.1)`, color: accent }}
            >
              {card.category}
            </span>
            <div className="flex items-center gap-3 text-caption text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {card.duration} min
              </span>
              <span className="flex items-center gap-1">
                <Signal className="h-3.5 w-3.5" />
                {card.difficulty}
              </span>
            </div>
          </div>

          {/* Title */}
          <h2 className="mt-6 text-balance text-title leading-tight sm:text-headline">
            {card.title}
          </h2>

          {/* Description */}
          <p className="mt-3 text-body text-muted-foreground">
            {card.description}
          </p>

          {/* Format + tags */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-secondary px-2.5 py-1 text-caption text-secondary-foreground">
              {FORMAT_LABELS[card.format]}
            </span>
            {card.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-lg bg-muted px-2.5 py-1 text-caption text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Why this */}
          <div className="mt-6 border-t border-border pt-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setWhyOpen((v) => !v);
                onExpandWhy();
              }}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="text-caption text-muted-foreground">
                Why this recommendation?
              </span>
              <motion.span animate={{ rotate: whyOpen ? 180 : 0 }} transition={{ duration: 0.2, ease: EASE }}>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </motion.span>
            </button>
            <motion.div
              initial={false}
              animate={{ height: whyOpen ? "auto" : 0, opacity: whyOpen ? 1 : 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="overflow-hidden"
            >
              <p className="pt-3 text-body italic text-foreground/80">
                {whyThis(card, state, profile)}
              </p>
            </motion.div>
          </div>
        </div>
      </div>

    </div>
  );
}
