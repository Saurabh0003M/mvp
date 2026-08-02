"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import {
  type EngineState,
  type UserProfile,
  topWeights,
  type Recommendation,
  type SwipeDirection,
  type IabtmChannel,
  CATEGORY_ACCENTS,
  FORMAT_LABELS,
  IABTM_CHANNELS,
  LIVE_CORPUS,
} from "@/lib/engine";
import { COOLING_THRESHOLD, type CompressedCognitiveState } from "@/lib/cognitive";
import { type VoiceReading } from "@/lib/voice";
import { type CoachMessage } from "@/hooks/use-engine";
import { AppShell, type Tab } from "./AppShell";
import { CardStack } from "./CardStack";
import { TasteProfileRail } from "./TasteProfileRail";
import { WellbeingRadar } from "./WellbeingRadar";
import { TrajectoryStrip } from "./TrajectoryStrip";
import { PivotBanner } from "./PivotBanner";
import { QuestsShelf } from "./QuestsShelf";
import { ContentViewer } from "./ContentViewer";
import { ProfileSheet } from "./ProfileSheet";
import { NotificationsSheet } from "./NotificationsSheet";
import { SearchSheet } from "./SearchSheet";
import { InsightSheet } from "./InsightSheet";
import { VoiceCoach } from "./VoiceCoach";
import { Toast } from "./Toast";

const EASE = [0.22, 1, 0.36, 1] as const;
type ExploreChannel = "All" | IabtmChannel;

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
  const [selectedChannel, setSelectedChannel] = useState<ExploreChannel>("All");
  const [questsOpen, setQuestsOpen] = useState(false);
  const [laterOpen, setLaterOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [viewerCard, setViewerCard] = useState<Recommendation | null>(null);
  // Whether the open card already carries a recorded decision. Preview (false)
  // means looking is free; the decision is made from inside the viewer.
  const [viewerDecided, setViewerDecided] = useState(false);
  const [showHints, setShowHints] = useState(true);
  const [dismissedCooldownTurn, setDismissedCooldownTurn] = useState<number | null>(null);
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

  const exploreCards = useMemo(() => {
    const unseen = LIVE_CORPUS.filter((card) => !state.seen.has(card.id));
    if (selectedChannel === "All") return unseen;
    return unseen.filter((card) => card.channel === selectedChannel);
  }, [selectedChannel, state.seen]);

  const selfInsight = useMemo(
    () => buildSelfInsight(state, profile),
    [state, profile]
  );

  const hasNotifications = Boolean(activeInsight) || Boolean(ccs && ccs.pivot);
  const cooldownDue = Boolean(
    ccs && ccs.consumptionRun >= COOLING_THRESHOLD && state.queue.length > 0
  );
  const showCooldown = cooldownDue && dismissedCooldownTurn !== ccs?.turn;

  const dismissCooldown = () => {
    if (ccs) setDismissedCooldownTurn(ccs.turn);
  };

  // Accept is a promise the product has to keep: the media opens immediately.
  // The engine still learns from the swipe exactly as before — we just stop
  // leaving the user holding a card that does nothing.
  const handleSwipe = (card: Recommendation, dir: SwipeDirection) => {
    onSwipe(card, dir);
    if (dir === "accept") {
      setViewerDecided(true);
      setViewerCard(card);
    }
  };

  // Looking is free. Opening a card from the deck or the grid records nothing —
  // the decision happens inside the viewer, once you actually know.
  const handlePreview = (card: Recommendation) => {
    setViewerDecided(false);
    setViewerCard(card);
  };

  // A decision made after seeing the real thing is the highest-quality signal
  // in the product, so it flows through the same engine path as a swipe.
  const handleDecide = (card: Recommendation, dir: SwipeDirection) => {
    onSwipe(card, dir);
  };

  // Right-rail context — always shows the aspiration + trajectory + pivot,
  // even on the Explore/Taste tabs, so identity stays anchored.
  // IABTM renders its progress surface as a single near-black panel in the
  // right rail. Mirroring that makes Ascend read as a native module.
  const rightRail = (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="flex min-h-[240px] flex-col justify-between rounded-2xl bg-panel p-5 text-panel-foreground"
      >
        <div>
          <div className="text-micro text-panel-foreground/55">You&apos;re currently at</div>
          <div className="mt-1.5 text-balance font-display text-xl font-medium leading-snug tracking-tight">
            Becoming {profile.aspiration}
          </div>
        </div>

        <div className="mt-6 space-y-2.5 border-t border-white/10 pt-4">
          <PanelStat label="Cards reviewed" value={state.history.length} />
          <PanelStat label="Quests accepted" value={state.accepted.length} />
          <PanelStat label="Saved for later" value={state.later.length} />
        </div>
      </motion.div>

      <TrajectoryStrip state={state} profile={profile} />
      <PivotBanner ccs={showCooldown ? null : ccs} compact />
    </div>
  );

  return (
    <AppShell
      tab={tab}
      onTab={setTab}
      onProfile={() => setProfileOpen(true)}
      onNotifications={() => setNotificationsOpen(true)}
      onSearch={() => setSearchOpen(true)}
      notificationsDot={hasNotifications}
      right={rightRail}
    >
      {/* ── HOME ── */}
      {tab === "home" && (
        <div className="mx-auto flex w-full max-w-[640px] flex-col items-center px-6 py-6">
          {selfInsight && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="mb-4 w-full border-b border-border pb-4 text-caption text-muted-foreground"
            >
              <span className="font-medium text-foreground">What I noticed about you:</span>{" "}
              {selfInsight}
            </motion.div>
          )}
          <div
            className="relative w-full"
            style={{ height: showCooldown ? "min(52vh, 520px)" : "min(78vh, 680px)" }}
          >
            <CardStack
              state={state}
              profile={profile}
              onSwipe={handleSwipe}
              onPreview={handlePreview}
              showHints={showHints}
              showCooldown={showCooldown}
              onCooldownDismiss={dismissCooldown}
            />
          </div>
          {showCooldown && (
            <PivotBanner ccs={ccs} className="w-full max-w-[520px]" />
          )}
        </div>
      )}

      {/* ── EXPLORE — IABTM channel grid ── */}
      {tab === "explore" && (
        <div className="mx-auto flex w-full max-w-[1120px] flex-col px-5 py-6 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="w-full"
          >
            <div className="text-micro text-muted-foreground">Explore</div>
            <h1 className="mt-1 text-balance font-display text-2xl font-medium leading-tight tracking-tight">
              Curated media
            </h1>
            <p className="mt-1 text-caption text-muted-foreground">
              Browse IABTM&apos;s six channels. Home stays personalized; Explore stays open.
            </p>
          </motion.div>

          <ChannelFilter selected={selectedChannel} onSelect={setSelectedChannel} />

          <div className="mt-5 w-full">
            {exploreCards.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 2xl:grid-cols-3">
                {exploreCards.map((card) => (
                  <ExploreTile key={card.id} card={card} onOpen={handlePreview} />
                ))}
              </div>
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-border p-8 text-center">
                <div className="text-title">No unseen items here.</div>
                <p className="mt-2 text-caption text-muted-foreground">
                  Switch channels or come back after new content is ingested.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TASTE — profile weights + Ryff wellbeing ── */}
      {tab === "taste" && (
        <div className="mx-auto w-full max-w-[640px] px-6 py-6">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="mb-4"
          >
            <div className="text-micro text-muted-foreground">You, from your swipes</div>
            <h1 className="mt-1 font-display text-2xl font-medium leading-tight tracking-tight">
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
      <ContentViewer
        card={viewerCard}
        onClose={() => setViewerCard(null)}
        onComplete={() => {}}
        decided={viewerDecided}
        onDecide={handleDecide}
      />
      <QuestsShelf open={questsOpen} onClose={() => setQuestsOpen(false)} state={state} mode="accepted" />
      <QuestsShelf open={laterOpen} onClose={() => setLaterOpen(false)} state={state} onResurface={onResurface} mode="later" />
      <InsightSheet insight={activeInsight} onApply={onApplyInsight} onDismiss={onDismissInsight} />
      <VoiceCoach messages={messages} reading={reading} onConverse={onConverse} />
      <Toast message={toast} />
    </AppShell>
  );
}

function ChannelFilter({
  selected,
  onSelect,
}: {
  selected: ExploreChannel;
  onSelect: (channel: ExploreChannel) => void;
}) {
  const channels = ["All", ...IABTM_CHANNELS] as const;

  return (
    <div className="mt-5 flex max-w-full gap-2 overflow-x-auto pb-1">
      {channels.map((channel) => {
        const active = selected === channel;
        return (
          <button
            key={channel}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(channel)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-caption font-medium transition-colors ${
              active
                ? "bg-foreground text-background"
                : "border border-border bg-card text-foreground hover:bg-accent"
            }`}
          >
            {channel}
          </button>
        );
      })}
    </div>
  );
}

function ExploreTile({
  card,
  onOpen,
}: {
  card: Recommendation;
  onOpen: (card: Recommendation) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const accent = CATEGORY_ACCENTS[card.category];
  const showImage = card.thumbnail && !imgError;

  return (
    <button
      type="button"
      onClick={() => onOpen(card)}
      className="block w-full overflow-hidden rounded-2xl border border-border bg-card text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
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
            className="flex h-full w-full items-center justify-center px-6 text-center text-subtitle text-background"
            style={{
              background: `linear-gradient(150deg, ${accent} 0%, hsl(from ${accent} h s calc(l * 0.65)) 100%)`,
            }}
          >
            {card.channel ?? card.category}
          </div>
        )}
        <div className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-micro text-foreground shadow-soft backdrop-blur-sm">
          {card.channel ?? "Ascend"}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between gap-3 text-caption text-muted-foreground">
          <span
            className="rounded-full px-2 py-0.5 text-micro"
            style={{ background: `hsl(from ${accent} h s l / 0.1)`, color: accent }}
          >
            {FORMAT_LABELS[card.format]}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {card.duration} min
          </span>
        </div>

        <h2 className="mt-3 text-balance font-display text-lg font-medium leading-snug">
          {card.hook ?? card.title}
        </h2>
        <p className="mt-1.5 text-caption text-muted-foreground line-clamp-2">
          {card.hook ? card.title : card.description}
        </p>
      </div>
    </button>
  );
}

function buildSelfInsight(state: EngineState, profile: UserProfile): string | null {
  if (state.history.length < 5) return null;

  const byId = new Map(LIVE_CORPUS.map((card) => [card.id, card]));
  const reviewed = state.history
    .map((interaction) => ({ interaction, card: byId.get(interaction.recommendationId) }))
    .filter((entry): entry is { interaction: typeof state.history[number]; card: Recommendation } =>
      Boolean(entry.card)
    );

  const overWindow = reviewed.filter((entry) => entry.card.duration > profile.dailyTime);
  const skippedOverWindow = overWindow.filter((entry) => entry.interaction.direction === "skip").length;
  const shortAccepted = reviewed.filter(
    (entry) => entry.interaction.direction === "accept" && entry.card.duration <= 15
  ).length;
  if (overWindow.length >= 3 && skippedOverWindow === overWindow.length && shortAccepted >= 2) {
    return `You skipped ${skippedOverWindow} items longer than your ${profile.dailyTime}-minute window and accepted ${shortAccepted} under 15. That points to calendar fit, not motivation.`;
  }

  const acceptedByChannel = new Map<IabtmChannel, number>();
  for (const entry of reviewed) {
    if (entry.interaction.direction !== "accept" || !entry.card.channel) continue;
    acceptedByChannel.set(entry.card.channel, (acceptedByChannel.get(entry.card.channel) ?? 0) + 1);
  }
  const channelLeaders = Array.from(acceptedByChannel.entries()).sort((a, b) => b[1] - a[1]);
  if (channelLeaders[0] && channelLeaders[0][1] >= 3 && channelLeaders[0][1] >= (channelLeaders[1]?.[1] ?? 0) + 2) {
    return `You accepted ${channelLeaders[0][1]} ${channelLeaders[0][0]} pieces. The medium is becoming part of the signal, not just the topic.`;
  }

  const acceptedFormats = Object.entries(state.counters.formats)
    .map(([format, counts]) => ({
      format: format as keyof typeof FORMAT_LABELS,
      accepts: counts.accept,
    }))
    .sort((a, b) => b.accepts - a.accepts);
  if (
    acceptedFormats[0] &&
    acceptedFormats[0].accepts >= 3 &&
    acceptedFormats[0].accepts >= (acceptedFormats[1]?.accepts ?? 0) + 2
  ) {
    return `You accepted ${acceptedFormats[0].accepts} ${FORMAT_LABELS[acceptedFormats[0].format].toLowerCase()} cards. Format is starting to matter as much as topic.`;
  }

  return null;
}

function PanelStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-caption text-panel-foreground/60">{label}</span>
      <span className="text-subtitle tabular-nums">{value}</span>
    </div>
  );
}
