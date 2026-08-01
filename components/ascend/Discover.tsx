"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type EngineState, type UserProfile, topWeights, type Recommendation, type SwipeDirection } from "@/lib/engine";
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

  // Track weight changes for count-up direction indicators
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const current = topWeights(state, profile);
    setPrevWeights(current.map((w) => ({ label: w.label, value: w.value })));
  }, [state.weights]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hide hints after first swipe
  useEffect(() => {
    if (state.history.length > 0) setShowHints(false);
  }, [state.history.length]);

  return (
    <div className="min-h-screen bg-background bg-grain">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-foreground text-background">
              <span className="text-subtitle font-semibold">A</span>
            </div>
            <span className="text-subtitle font-semibold tracking-tight">Ascend</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
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

      {/* Becoming banner */}
      <div className="mx-auto max-w-7xl px-5 pt-8 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <div className="text-micro text-muted-foreground">Becoming</div>
          <h1 className="text-balance text-display mt-1">{profile.aspiration}</h1>
        </motion.div>
        <PivotBanner ccs={ccs} />
      </div>

      {/* Main layout */}
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
          {/* Card stack column */}
          <div className="flex flex-col items-center">
            <div className="relative h-[460px] w-full max-w-md sm:h-[520px]">
              <CardStack
                state={state}
                profile={profile}
                onSwipe={onSwipe}
                showHints={showHints}
              />
            </div>

            {/* Trajectory */}
            <div className="mt-24">
              <TrajectoryStrip state={state} profile={profile} />
            </div>
          </div>

          {/* Taste profile rail — desktop */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <TasteProfileRail state={state} profile={profile} prevWeights={prevWeights} ccs={ccs} />
            </div>
          </aside>
        </div>
      </main>

      {/* Mobile taste profile toggle */}
      <div className="lg:hidden">
        <button
          onClick={() => setRailOpen((v) => !v)}
          className="mx-auto flex w-full max-w-md items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-caption text-foreground/80 shadow-soft"
        >
          Taste Profile
          <ChevronDown className="h-4 w-4" />
        </button>
        <AnimatePresence>
          {railOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="overflow-hidden px-5"
            >
              <div className="mt-4">
                <TasteProfileRail state={state} profile={profile} prevWeights={prevWeights} ccs={ccs} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Drawers */}
      <QuestsShelf open={questsOpen} onClose={() => setQuestsOpen(false)} state={state} mode="accepted" />
      <QuestsShelf open={laterOpen} onClose={() => setLaterOpen(false)} state={state} onResurface={onResurface} mode="later" />

      {/* Insight sheet */}
      <InsightSheet insight={activeInsight} onApply={onApplyInsight} onDismiss={onDismissInsight} />

      {/* Push-to-talk conversational coach */}
      <VoiceCoach messages={messages} reading={reading} onConverse={onConverse} />

      {/* Toast */}
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
