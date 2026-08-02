"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  type Recommendation,
  type EngineState,
  type UserProfile,
  CATEGORY_ACCENTS,
  FORMAT_LABELS,
  MEDIA_KIND_LABELS,
  MEDIA_KIND_ACTION,
  resolveMediaKind,
  whyThis,
} from "@/lib/engine";
import { ChevronDown, Clock } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

interface Props {
  card: Recommendation;
  state: EngineState;
  profile: UserProfile;
  dragX: number;
  dragY: number;
  isTop: boolean;
  onExpandWhy: () => void;
  /** Tap the card body to preview the media without deciding. */
  onPreview?: () => void;
}

const SOURCE_ICONS: Record<string, string> = {
  YouTube: "▶",
  Podcast: "◉",
  Article: "▤",
  IABTM: "✦",
};

function accentGradient(accent: string): string {
  return `linear-gradient(150deg, ${accent} 0%, hsl(from ${accent} h s calc(l * 0.65)) 100%)`;
}

export function RecommendationCard({
  card,
  state,
  profile,
  dragX,
  dragY,
  isTop,
  onExpandWhy,
  onPreview,
}: Props) {
  const [whyOpen, setWhyOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const accent = CATEGORY_ACCENTS[card.category];
  const source = card.source ?? "IABTM";
  const showImage = card.thumbnail && !imgError;
  const kind = resolveMediaKind(card);

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
        {/* Thumbnail / gradient fallback — fixed aspect ratio */}
        {/* shrink-0 is load-bearing: this sits in a fixed-height flex column,
            so without it the image is the first thing the browser compresses
            when the text below is long — which is why some cards showed a
            sliver of thumbnail and some showed none at all. */}
        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden">
          {showImage ? (
            <img
              src={card.thumbnail}
              alt=""
              loading="lazy"
              onError={() => setImgError(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{ background: accentGradient(accent) }}
            />
          )}
          {/* Subtle warm wash over the image for editorial cohesion */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, transparent 40%, hsl(40 44% 99% / 0.55) 100%)",
            }}
          />
          {/* Source badge */}
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-background/85 px-2.5 py-1 backdrop-blur-sm">
            <span className="text-[11px]" style={{ color: accent }}>
              {SOURCE_ICONS[source] ?? "✦"}
            </span>
            <span className="text-micro text-foreground/80">{source}</span>
          </div>
          {/* Category accent line at bottom of image */}
          <div className="absolute bottom-0 left-0 h-1 w-full" style={{ background: accent }} />
        </div>

        <div className="flex flex-1 flex-col p-6 sm:p-7">
          {/* Meta row — deliberately minimal. Duration used to sit here in the
              corner, which prices the content before you're curious about it
              and makes a feed read like a syllabus. It now lives with the
              action, where it helps you plan instead of talking you out. */}
          <div className="flex items-center justify-between">
            <span
              className="rounded-full px-2.5 py-0.5 text-micro"
              style={{ background: `hsl(from ${accent} h s l / 0.1)`, color: accent }}
            >
              {card.category}
            </span>
            <span className="text-micro text-muted-foreground">
              {MEDIA_KIND_LABELS[kind]}
            </span>
          </div>

          {/* THE HOOK — the card leads with an open loop, not a topic label.
              Curiosity is created by a gap the reader wants closed; the title
              is only the answer to it, so it drops to a supporting line. */}
          <h2 className="mt-4 text-balance text-title leading-tight">
            {card.hook ?? card.title}
          </h2>

          {card.hook && (
            <p className="mt-1.5 text-caption text-muted-foreground/80">{card.title}</p>
          )}

          {/* Description */}
          <p className="mt-2.5 text-body text-muted-foreground">
            {card.description}
          </p>

          {/* Format + tags */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-secondary px-2.5 py-1 text-caption text-secondary-foreground">
              {FORMAT_LABELS[card.format]}
            </span>
            {card.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-lg bg-muted px-2.5 py-1 text-caption text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>

          <div className="flex-1" />

          {/* The promise. Says what accepting actually does — and only here,
              paired with the payoff, does the time cost appear. */}
          <div className="mt-5 flex items-center gap-2 text-caption text-muted-foreground">
            <span className="font-medium text-foreground/80">
              Swipe right → {MEDIA_KIND_ACTION[kind]}
            </span>
            <span aria-hidden>·</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {card.duration} min
            </span>
          </div>

          {onPreview && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPreview();
              }}
              className="mt-3 w-full rounded-full bg-foreground py-2.5 text-caption text-background transition-opacity hover:opacity-90"
            >
              Preview it — free, no decision
            </button>
          )}

          {/* Why this */}
          <div className="mt-4 border-t border-border pt-3.5">
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
