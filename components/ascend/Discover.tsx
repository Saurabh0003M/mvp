"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import {
  type EngineState,
  type UserProfile,
  topWeights,
  type Recommendation,
  type SwipeDirection,
  RECOMMENDATIONS,
} from "@/lib/engine";
import { type CompressedCognitiveState } from "@/lib/cognitive";
import { type VoiceReading } from "@/lib/voice";
import { type CoachMessage } from "@/hooks/use-engine";
import { AppShell, type Tab } from "./AppShell";
import { CardStack } from "./CardStack";
import { TasteProfileRail } from "./TasteProfileRail";
import { WellbeingRadar } from "./WellbeingRadar";
import { TrajectoryStrip } from "./TrajectoryStrip";
import { PivotBanner } from "./PivotBanner";
import { QuestsShelf } from "./QuestsShelf";
import { ProfileSheet } from "./ProfileSheet";
import { NotificationsSheet } from "./NotificationsSheet";
import { SearchSheet } from "./SearchSheet";
import { InsightSheet } from "./InsightSheet";
import { VoiceCoach } from "./VoiceCoach";
import { Toast } from "./Toast";

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
  const [tab, setTab] = useState<Tab>("home");
  const [questsOpen, setQuestsOpen] = useState(false);
  const [laterOpen, setLaterOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showHints, setShowHints] = useState(true);
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

  // Global search shortcut (⌘K / Ctrl+K)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Explore mode = a shuffled shim over state.queue. Same swipe path, same
  // engine learning — just surfaces cards in a non-relevance order to invite
  // discovery of things the ranker wouldn't have led with.
  const exploreState = useMemo<EngineState>(() => {
    // Fisher–Yates over the unseen corpus, filtered against state.seen.
    const pool = RECOMMENDATIONS.filter((c) => !state.seen.has(c.id));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return { ...state, queue: pool };
    // Re-shuffle whenever the seen set grows (i.e. after a swipe), not on
    // every render — otherwise the deck would reshuffle mid-drag.
  }, [state, state.seen.size]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasNotifications = Boolean(activeInsight) || Boolean(ccs && ccs.pivot);

  return (
    <AppShell
      tab={tab}
      onTab={setTab}
      onProfile={() => setProfileOpen(true)}
      onNotifications={() => setNotificationsOpen(true)}
      onSearch={() => setSearchOpen(true)}
      notificationsDot={hasNotifications}
    >
      {/* ── HOME ── */}
      {tab === "home" && (
        <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 pt-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="w-full"
          >
            <div className="text-micro text-muted-foreground">Becoming</div>
            <h1 className="mt-1 text-balance font-display text-2xl font-medium leading-tight tracking-tight sm:text-3xl">
              {profile.aspiration}
            </h1>
          </motion.div>
          <div className="mt-3 flex w-full flex-wrap items-center gap-2">
            <TrajectoryStrip state={state} profile={profile} />
            <PivotBanner ccs={ccs} />
          </div>

          <div className="relative mt-6 w-full" style={{ height: "min(72vh, 640px)" }}>
            <CardStack
              state={state}
              profile={profile}
              ccs={ccs}
              onSwipe={onSwipe}
              showHints={showHints}
            />
          </div>
          <div className="h-20" />
        </div>
      )}

      {/* ── EXPLORE — shuffled random flashcards ── */}
      {tab === "explore" && (
        <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 pt-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="w-full"
          >
            <div className="text-micro text-muted-foreground">Explore</div>
            <h1 className="mt-1 text-balance font-display text-2xl font-medium leading-tight tracking-tight sm:text-3xl">
              Something you weren&apos;t looking for
            </h1>
            <p className="mt-1 text-caption text-muted-foreground">
              A shuffled deck outside your usual pattern. Swipe still teaches the engine.
            </p>
          </motion.div>

          <div className="relative mt-6 w-full" style={{ height: "min(72vh, 640px)" }}>
            {exploreState.queue.length > 0 ? (
              <CardStack
                state={exploreState}
                profile={profile}
                ccs={ccs}
                onSwipe={onSwipe}
                showHints={false}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-border p-8 text-center">
                <div className="text-title">You&apos;ve seen the deck.</div>
                <p className="mt-2 text-caption text-muted-foreground">
                  Come back after new content is ingested.
                </p>
              </div>
            )}
          </div>
          <div className="h-20" />
        </div>
      )}

      {/* ── TASTE — profile weights + Ryff wellbeing ── */}
      {tab === "taste" && (
        <div className="mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="mb-4"
          >
            <div className="text-micro text-muted-foreground">You, from your swipes</div>
            <h1 className="mt-1 font-display text-2xl font-medium leading-tight tracking-tight sm:text-3xl">
              Taste &amp; Wellbeing
            </h1>
          </motion.div>
          <div className="space-y-4 pb-6">
            <TasteProfileRail state={state} profile={profile} prevWeights={prevWeights} />
            {ccs && <WellbeingRadar ccs={ccs} />}
          </div>
        </div>
      )}

      {/* Drawers + overlays */}
      <ProfileSheet
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        profile={profile}
        state={state}
        onOpenQuests={() => setQuestsOpen(true)}
        onOpenLater={() => setLaterOpen(true)}
      />
      <NotificationsSheet
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        state={state}
        ccs={ccs}
        activeInsight={activeInsight}
        onApplyInsight={onApplyInsight}
      />
      <SearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} />
      <QuestsShelf open={questsOpen} onClose={() => setQuestsOpen(false)} state={state} mode="accepted" />
      <QuestsShelf open={laterOpen} onClose={() => setLaterOpen(false)} state={state} onResurface={onResurface} mode="later" />
      <InsightSheet insight={activeInsight} onApply={onApplyInsight} onDismiss={onDismissInsight} />
      <VoiceCoach messages={messages} reading={reading} onConverse={onConverse} />
      <Toast message={toast} />
    </AppShell>
  );
}
