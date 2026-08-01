"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  type EngineState,
  type UserProfile,
  topWeights,
  type Recommendation,
  type SwipeDirection,
} from "@/lib/engine";
import { type CompressedCognitiveState } from "@/lib/cognitive";
import { type VoiceReading } from "@/lib/voice";
import { type CoachMessage } from "@/hooks/use-engine";
import { CardStack } from "./CardStack";
import { TasteProfileRail } from "./TasteProfileRail";
import { TrajectoryStrip } from "./TrajectoryStrip";
import { QuestsShelf } from "./QuestsShelf";
import { InsightSheet } from "./InsightSheet";
import { PivotBanner } from "./PivotBanner";
import { VoiceCoach } from "./VoiceCoach";
import { Toast } from "./Toast";
import { Check, Bookmark, ChevronDown } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

interface Props {
  state: EngineState;
  profile: UserProfile;
  ccs: CompressedCognitiveState | null;
  messages: CoachMessage[];
  reading: VoiceReading | null;
  onSwipe: (card: Recommendation, dir: SwipeDirection) => void;
  onResurface: (id: string) => void;
  onConverse: (text: string) => void;
  activeInsight: import("@/lib/engine").Insight | null;
  onApplyInsight: () => void;
  onDismissInsight: () => void;
  toast: string | null;
}

export function Discover({
  state,
  profile,
  ccs,
  messages,
  reading,
  onSwipe,
  onResurface,
  onConverse,
  activeInsight,
  onApplyInsight,
  onDismissInsight,
  toast,
}: Props) {
  const [questsOpen, setQuestsOpen] = useState(false);
  const [laterOpen, setLaterOpen] = useState(false);
  const [showHints, setShowHints] = useState(true);
  const [railOpen, setRailOpen] = useState(false);
  const [prevWeights, setPrevWeights] = useState(() =>
    topWeights(state, profile).map((w) => ({ label: w.label, value: w.value }))
  );
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const current = topWeights(state, profile);
    setPrevWeights(current.map((w) => ({ label: w.label, value: w.value })));
  }, [state.weights]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.history.length > 0) setShowHints(false);
  }, [state.history.length]);

  return (
    <div className="flex min-h-screen flex-col bg-sunfade bg-grain">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-5 py-3.5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background">
              <span className="text-caption font-semibold">A</span>
            </div>
            <span className="text-subtitle font-semibold tracking-tight">Ascend</span>
          </div>
          <div className="flex items-center gap-2">
            <CounterChip
              label="Today's Quests"
              count={state.accepted.length}
              icon={<Check className="h-3.5 w-3.5" />}
              onClick={() => setQuestsOpen(true)}
            />
            <CounterChip
              label="Maybe Later"
              count={state.later.length}
              icon={<Bookmark className="h-3.5 w-3.5" />}
              onClick={() => setLaterOpen(true)}
            />
          </div>
        </div>
      </header>

      {/* ── Becoming banner + trajectory/pivot row ──────────────── */}
      <div className="mx-auto w-full max-w-7xl px-5 pt-8 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <div className="text-micro text-muted-foreground">Becoming</div>
          <h1 className="mt-1 text-balance font-display text-2xl font-medium leading-tight tracking-tight sm:text-3xl">
            {profile.aspiration}
          </h1>
        </motion.div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <TrajectoryStrip state={state} profile={profile} />
          <PivotBanner ccs={ccs} />
        </div>
      </div>

      {/* ── Two-column body — wide card, fixed-width rail ───────── */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 sm:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_340px]">
          {/* Card stack column */}
          <div className="flex flex-col items-center">
            <div className="relative w-full max-w-md" style={{ height: "min(75vh, 660px)" }}>
              <CardStack
                state={state}
                profile={profile}
                ccs={ccs}
                onSwipe={onSwipe}
                showHints={showHints}
              />
            </div>

            {/* Space for the action buttons that hang -bottom-16 off the card container */}
            <div className="h-20" />

            {/* Mobile taste-profile accordion */}
            <div className="w-full max-w-md lg:hidden">
              <button
                onClick={() => setRailOpen((v) => !v)}
                aria-expanded={railOpen}
                className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-caption text-foreground/80 shadow-soft"
              >
                Taste Profile &amp; Wellbeing
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${railOpen ? "rotate-180" : ""}`}
                />
              </button>
              <AnimatePresence>
                {railOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3">
                      <TasteProfileRail
                        state={state}
                        profile={profile}
                        prevWeights={prevWeights}
                        ccs={ccs}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Taste profile rail — desktop */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-4 pr-1">
              <TasteProfileRail
                state={state}
                profile={profile}
                prevWeights={prevWeights}
                ccs={ccs}
              />
            </div>
          </aside>
        </div>
      </main>

      {/* Drawers + overlays */}
      <QuestsShelf open={questsOpen} onClose={() => setQuestsOpen(false)} state={state} mode="accepted" />
      <QuestsShelf open={laterOpen} onClose={() => setLaterOpen(false)} state={state} onResurface={onResurface} mode="later" />
      <InsightSheet insight={activeInsight} onApply={onApplyInsight} onDismiss={onDismissInsight} />
      <VoiceCoach messages={messages} reading={reading} onConverse={onConverse} />
      <Toast message={toast} />
    </div>
  );
}

function CounterChip({
  label,
  count,
  icon,
  onClick,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-caption text-foreground/80 transition-all hover:border-foreground/30 hover:bg-accent"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[11px] font-semibold text-background tabular-nums">
        {count}
      </span>
    </button>
  );
}
