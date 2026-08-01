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

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="mx-auto flex w-full max-w-screen-xl flex-1 gap-0 px-5 sm:px-8">

        {/* LEFT: identity + trajectory, hidden below lg */}
        <aside className="hidden w-56 shrink-0 py-8 pr-6 lg:flex lg:flex-col xl:w-64 xl:pr-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="sticky top-24"
          >
            <div className="text-micro text-muted-foreground">Becoming</div>
            <h1 className="mt-1 text-balance font-display text-2xl font-medium leading-tight tracking-tight xl:text-3xl">
              {profile.aspiration}
            </h1>
            <div className="mt-6">
              <PivotBanner ccs={ccs} />
            </div>
            <div className="mt-6">
              <TrajectoryStrip state={state} profile={profile} />
            </div>
          </motion.div>
        </aside>

        {/* CENTRE: card stack — fills the available space, capped at a comfortable card width */}
        <main className="flex flex-1 flex-col items-center py-8">
          {/* Mobile identity row */}
          <div className="mb-6 w-full lg:hidden">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <div className="text-micro text-muted-foreground">Becoming</div>
              <h1 className="mt-0.5 font-display text-2xl font-medium leading-tight tracking-tight">
                {profile.aspiration}
              </h1>
            </motion.div>
            <div className="mt-3">
              <PivotBanner ccs={ccs} />
            </div>
          </div>

          {/* Card area — tall enough to show the full card with thumbnail */}
          <div className="relative w-full" style={{ maxWidth: 480 }}>
            <div className="relative" style={{ height: "min(72vh, 640px)" }}>
              <CardStack
                state={state}
                profile={profile}
                ccs={ccs}
                onSwipe={onSwipe}
                showHints={showHints}
              />
            </div>

            {/* Action buttons row — sits 16px below the card container */}
            {/* (CardStack renders buttons at -bottom-16; this spacer absorbs that) */}
            <div className="h-16" />

            {/* Trajectory — mobile only (desktop shows it in the left aside) */}
            <div className="mt-4 flex justify-center lg:hidden">
              <TrajectoryStrip state={state} profile={profile} />
            </div>
          </div>

          {/* Mobile taste-profile accordion */}
          <div className="mt-8 w-full lg:hidden" style={{ maxWidth: 480 }}>
            <button
              onClick={() => setRailOpen((v) => !v)}
              aria-expanded={railOpen}
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-caption text-foreground/80 shadow-soft"
            >
              Taste Profile & Wellbeing
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
        </main>

        {/* RIGHT: taste profile + wellbeing, hidden below lg */}
        <aside className="hidden w-64 shrink-0 py-8 pl-6 lg:block xl:w-72 xl:pl-8">
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

      {/* Drawers */}
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
