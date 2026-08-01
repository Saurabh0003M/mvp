"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, useMotionValue, useTransform, animate, type PanInfo } from "framer-motion";
import { RecommendationCard } from "./RecommendationCard";
import { type EngineState, type UserProfile, type Recommendation, type SwipeDirection } from "@/lib/engine";

const EASE = [0.22, 1, 0.36, 1] as const;
const SWIPE_THRESHOLD = 120;
const FLY_DISTANCE = 600;

interface Props {
  state: EngineState;
  profile: UserProfile;
  onSwipe: (card: Recommendation, dir: SwipeDirection) => void;
  showHints: boolean;
}

export function CardStack({ state, profile, onSwipe, showHints }: Props) {
  const stack = state.queue.slice(0, 3);
  const topCard = stack[0];
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const [dragProgress, setDragProgress] = useState({ x: 0, y: 0 });
  const [, setIsDragging] = useState(false);
  // Mirrored in state so the `drag` prop re-evaluates: a ref alone never
  // triggers a re-render, which could leave the card permanently undraggable.
  const [isAnimating, setIsAnimating] = useState(false);
  const animatingRef = useRef(false);
  const controlsRef = useRef<{ cancel: () => void } | null>(null);

  const triggerSwipe = useCallback(
    (dir: SwipeDirection) => {
      if (animatingRef.current || !topCard) return;
      animatingRef.current = true;
      setIsAnimating(true);

      const offsets: Record<SwipeDirection, { x: number; y: number; r: number }> = {
        accept: { x: FLY_DISTANCE, y: 40, r: 18 },
        skip: { x: -FLY_DISTANCE, y: 40, r: -18 },
        later: { x: 0, y: FLY_DISTANCE, r: 0 },
      };
      const off = offsets[dir];

      controlsRef.current?.cancel();
      const cx = animate(x, off.x, { duration: 0.32, ease: EASE });
      const cy = animate(y, off.y, { duration: 0.32, ease: EASE });
      controlsRef.current = {
        cancel: () => { cx.cancel(); cy.cancel(); },
      };

      setTimeout(() => {
        onSwipe(topCard, dir);
        x.set(0);
        y.set(0);
        setDragProgress({ x: 0, y: 0 });
        animatingRef.current = false;
        setIsAnimating(false);
      }, 340);
    },
    [topCard, onSwipe, x, y]
  );

  // Keyboard support. Ignored while the user is typing (the voice coach) or
  // while a modal/drawer is open, so arrow keys never swipe the card behind an
  // overlay or hijack cursor movement in a text field.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;

      const el = document.activeElement as HTMLElement | null;
      if (el) {
        const tag = el.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable) return;
      }
      // Any open overlay (coach, drawer, insight sheet) owns the keyboard.
      if (document.querySelector("[data-overlay-open]")) return;

      if (e.key === "ArrowRight") { e.preventDefault(); triggerSwipe("accept"); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); triggerSwipe("skip"); }
      else if (e.key === "ArrowDown") { e.preventDefault(); triggerSwipe("later"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [triggerSwipe]);

  const snapBack = useCallback(() => {
    controlsRef.current?.cancel();
    const cx = animate(x, 0, { duration: 0.3, ease: EASE });
    const cy = animate(y, 0, { duration: 0.3, ease: EASE });
    controlsRef.current = {
      cancel: () => { cx.cancel(); cy.cancel(); },
    };
  }, [x, y]);

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    const dx = info.offset.x;
    const dy = info.offset.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > SWIPE_THRESHOLD) triggerSwipe("accept");
      else if (dx < -SWIPE_THRESHOLD) triggerSwipe("skip");
      else snapBack();
    } else {
      if (dy > SWIPE_THRESHOLD) triggerSwipe("later");
      else snapBack();
    }
  };

  if (!topCard) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-[1.75rem] border border-dashed border-border">
        <div className="text-center">
          <div className="text-title text-muted-foreground">You&apos;ve seen every quest</div>
          <p className="mt-2 text-body text-muted-foreground/70">
            Adjust your taste profile or revisit Maybe Later to resurface a quest.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* Background cards */}
      {stack.slice(1).map((card, i) => (
        <motion.div
          key={card.id}
          className="absolute inset-0"
          initial={false}
          animate={{
            scale: 1 - (i + 1) * 0.04,
            y: (i + 1) * 14,
            opacity: 1 - (i + 1) * 0.3,
          }}
          transition={{ duration: 0.3, ease: EASE }}
          style={{ zIndex: 10 - i }}
        >
          <div className="h-full w-full rounded-[1.75rem] border border-border bg-card shadow-soft" />
        </motion.div>
      ))}

      {/* Top draggable card */}
      <motion.div
        key={topCard.id}
        className="absolute inset-0 cursor-grab"
        style={{ x, y, rotate, zIndex: 20 }}
        drag={!isAnimating}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.7}
        onDragStart={() => setIsDragging(true)}
        onDrag={(_, info) => setDragProgress({ x: info.offset.x, y: info.offset.y })}
        onDragEnd={handleDragEnd}
        whileTap={{ cursor: "grabbing" }}
      >
        <RecommendationCard
          card={topCard}
          state={state}
          profile={profile}
          dragX={dragProgress.x}
          dragY={dragProgress.y}
          isTop
          onExpandWhy={() => {}}
        />
      </motion.div>

      {/* Action buttons — the ONLY control row. The keyboard hint lives inside
          each button on the first card, so hints can never overlap the row. */}
      <div className="absolute -bottom-16 inset-x-0 flex items-center justify-center gap-2.5 sm:gap-3">
        <ActionButton label="Skip" arrow="←" showArrow={showHints} onClick={() => triggerSwipe("skip")} color="danger" />
        <ActionButton label="Later" arrow="↓" showArrow={showHints} onClick={() => triggerSwipe("later")} color="warning" />
        <ActionButton label="Accept" arrow="→" showArrow={showHints} onClick={() => triggerSwipe("accept")} color="success" />
      </div>
    </div>
  );
}

function ActionButton({
  label,
  arrow,
  showArrow,
  onClick,
  color,
}: {
  label: string;
  arrow: string;
  showArrow: boolean;
  onClick: () => void;
  color: "success" | "warning" | "danger";
}) {
  const styles: Record<string, string> = {
    success: "border-success/30 text-success hover:bg-success/10 hover:border-success/50",
    warning: "border-warning/30 text-warning hover:bg-warning/10 hover:border-warning/50",
    danger: "border-danger/30 text-danger hover:bg-danger/10 hover:border-danger/50",
  };
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      aria-label={`${label} this recommendation`}
      aria-keyshortcuts={arrow === "←" ? "ArrowLeft" : arrow === "→" ? "ArrowRight" : "ArrowDown"}
      className={`flex items-center gap-1.5 rounded-full border bg-card px-4 py-2.5 text-caption font-medium shadow-soft transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-5 ${styles[color]}`}
    >
      {showArrow && <span aria-hidden className="opacity-60">{arrow}</span>}
      {label}
    </motion.button>
  );
}
