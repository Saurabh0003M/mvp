"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, useMotionValue, useTransform, animate, type PanInfo } from "framer-motion";
import { RecommendationCard } from "./RecommendationCard";
import { type EngineState, type UserProfile, type Recommendation, type SwipeDirection } from "@/lib/engine";
import { Moon, RotateCcw } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;
const SWIPE_THRESHOLD = 120;
const FLY_DISTANCE = 600;

interface Props {
  state: EngineState;
  profile: UserProfile;
  onSwipe: (card: Recommendation, dir: SwipeDirection) => void;
  showHints: boolean;
  showCooldown: boolean;
  onCooldownDismiss: () => void;
}

export function CardStack({
  state,
  profile,
  onSwipe,
  showHints,
  showCooldown,
  onCooldownDismiss,
}: Props) {
  const stack = state.queue.slice(0, 3);
  const topCard = stack[0];
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const [dragProgress, setDragProgress] = useState({ x: 0, y: 0 });
  const [, setIsDragging] = useState(false);
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el) {
        const tag = el.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable) return;
      }
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

  // Cooldown card — consent gate, not content. Fires when consumption run hits threshold.
  if (!topCard) {
    return <AlgorithmicCooling />;
  }

  return (
    <div className="relative h-full w-full">
      {/* Background cards — peeking behind the top one */}
      {stack.slice(1).map((card, i) => (
        <motion.div
          key={card.id}
          className="absolute inset-0"
          initial={false}
          animate={{
            scale: 1 - (i + 1) * 0.05,
            y: (i + 1) * 18,
            opacity: 1 - (i + 1) * 0.28,
          }}
          transition={{ duration: 0.3, ease: EASE }}
          style={{ zIndex: 10 - i }}
        >
          <div className="h-full w-full rounded-[1.75rem] border border-border bg-card shadow-soft" />
        </motion.div>
      ))}

      {/* Cooldown card overlays the top content card */}
      {showCooldown ? (
        <CooldownCard
          onContinue={onCooldownDismiss}
          onRest={() => {
            onCooldownDismiss();
            triggerSwipe("later");
          }}
        />
      ) : (
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
      )}

      {/* Action buttons */}
      {!showCooldown && (
        <div className="absolute -bottom-16 inset-x-0 flex items-center justify-center gap-2.5 sm:gap-3">
          <ActionButton label="Skip" arrow="←" showArrow={showHints} onClick={() => triggerSwipe("skip")} color="danger" />
          <ActionButton label="Later" arrow="↓" showArrow={showHints} onClick={() => triggerSwipe("later")} color="warning" />
          <ActionButton label="Accept" arrow="→" showArrow={showHints} onClick={() => triggerSwipe("accept")} color="success" />
        </div>
      )}
    </div>
  );
}

function CooldownCard({ onContinue, onRest }: { onContinue: () => void; onRest: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-warning/50 bg-sunfade p-8 text-center shadow-lifted"
    >
      <motion.div
        initial={{ rotate: -8, scale: 0.9 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/15"
      >
        <Moon className="h-7 w-7 text-warning" />
      </motion.div>
      <div className="text-micro mt-5 text-muted-foreground">A pause, not a push</div>
      <h2 className="mt-2 text-balance text-headline">Take five?</h2>
      <p className="mt-3 max-w-xs text-body text-muted-foreground">
        You&apos;ve been taking in a lot. Rest is part of the work too. You can keep going, or step away — both are fine.
      </p>
      <div className="mt-7 flex gap-3">
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={(event) => {
            event.stopPropagation();
            onRest();
          }}
          className="rounded-full border border-border bg-card px-5 py-3 text-subtitle text-foreground/80 shadow-soft transition-all hover:bg-accent"
        >
          Step away
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={(event) => {
            event.stopPropagation();
            onContinue();
          }}
          className="rounded-full bg-foreground px-5 py-3 text-subtitle text-background shadow-soft transition-all hover:shadow-card"
        >
          Keep going
        </motion.button>
      </div>
    </motion.div>
  );
}

function AlgorithmicCooling() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="flex h-full w-full flex-col items-center justify-center rounded-[1.75rem] border border-border bg-sunfade bg-grain text-center shadow-soft"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.15 }}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-foreground/5"
      >
        <RotateCcw className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
      </motion.div>
      <div className="text-micro mt-6 text-muted-foreground">Algorithmic cooling</div>
      <h2 className="mt-2 max-w-xs text-balance text-headline">
        You have enough input. Go execute.
      </h2>
      <p className="mt-3 max-w-xs text-body text-muted-foreground">
        Come back tomorrow. The deck is finite on purpose — what you do with it is the point.
      </p>
    </motion.div>
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
