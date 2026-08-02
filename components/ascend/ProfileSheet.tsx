"use client";

import { motion, AnimatePresence } from "framer-motion";
import { type UserProfile, type EngineState, type IabtmChannel, CATEGORY_ACCENTS } from "@/lib/engine";
import { X, Check, Bookmark, ChevronRight, ArrowRight } from "lucide-react";

const ARTIFACT_ACCEPTED_THRESHOLD = 5;

interface Props {
  open: boolean;
  onClose: () => void;
  profile: UserProfile;
  state: EngineState;
  onOpenQuests: () => void;
  onOpenLater: () => void;
}

export function ProfileSheet({ open, onClose, profile, state, onOpenQuests, onOpenLater }: Props) {
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
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            data-overlay-open
            role="dialog"
            aria-modal="true"
            className="fixed left-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-r border-border bg-card shadow-lifted"
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <div>
                <div className="text-micro text-muted-foreground">Becoming</div>
                <h2 className="text-headline mt-1">{profile.aspiration}</h2>
              </div>
              <button onClick={onClose} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              <div>
                <div className="text-micro text-muted-foreground">Interests</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile.interests.map((c) => (
                    <span
                      key={c}
                      className="rounded-full px-2.5 py-1 text-caption"
                      style={{ background: `hsl(from ${CATEGORY_ACCENTS[c]} h s l / 0.1)`, color: CATEGORY_ACCENTS[c] }}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex gap-6">
                <div>
                  <div className="text-micro text-muted-foreground">Experience</div>
                  <div className="text-body mt-1 text-foreground/90">{profile.experience}</div>
                </div>
                <div>
                  <div className="text-micro text-muted-foreground">Daily window</div>
                  <div className="text-body mt-1 text-foreground/90">{profile.dailyTime} min</div>
                </div>
              </div>

              {state.accepted.length >= ARTIFACT_ACCEPTED_THRESHOLD && (
                <IdentityArtifactCard profile={profile} state={state} />
              )}

              <div className="space-y-2 border-t border-border pt-5">
                <button
                  onClick={() => { onClose(); onOpenQuests(); }}
                  className="flex w-full items-center justify-between rounded-2xl border border-border bg-background p-4 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                      <Check className="h-4 w-4 text-foreground/70" />
                    </div>
                    <div>
                      <div className="text-subtitle leading-tight">Today&apos;s Quests</div>
                      <div className="text-caption text-muted-foreground">{state.accepted.length} accepted</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>

                <button
                  onClick={() => { onClose(); onOpenLater(); }}
                  className="flex w-full items-center justify-between rounded-2xl border border-border bg-background p-4 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                      <Bookmark className="h-4 w-4 text-foreground/70" />
                    </div>
                    <div>
                      <div className="text-subtitle leading-tight">Maybe Later</div>
                      <div className="text-caption text-muted-foreground">{state.later.length} saved</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function IdentityArtifactCard({
  profile,
  state,
}: {
  profile: UserProfile;
  state: EngineState;
}) {
  const channelSummary = getAcceptedChannelSummary(state);
  const attributeShift = getAttributeShift(state);
  const artifactLine = buildArtifactLine({
    acceptedCount: state.accepted.length,
    savedCount: state.later.length,
    reviewedCount: state.history.length,
    channelCount: channelSummary.totalChannels,
  });

  return (
    <section className="rounded-2xl border border-white/10 bg-panel p-5 text-panel-foreground">
      <div>
        <div className="text-micro text-panel-foreground/55">Your artifact</div>
        <h3 className="mt-1 font-display text-xl font-medium leading-snug">
          Becoming {profile.aspiration}
        </h3>
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        <div className="text-micro text-panel-foreground/55">Top channels</div>
        {channelSummary.topChannels.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {channelSummary.topChannels.map(({ channel, count }) => (
              <span
                key={channel}
                className="rounded-full bg-white/10 px-2.5 py-1 text-micro text-panel-foreground/90"
              >
                {channel} {count}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-caption text-panel-foreground/60">
            No channel data in accepted quests.
          </p>
        )}
      </div>

      {attributeShift && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-white/20 px-2.5 py-1 text-caption text-panel-foreground">
              {attributeShift.current}
            </span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-panel-foreground/50" />
            <span className="rounded-full bg-foreground px-2.5 py-1 text-caption text-background">
              {attributeShift.imagined}
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
        <ArtifactStat label="Accepted" value={state.accepted.length} />
        <ArtifactStat label="Saved" value={state.later.length} />
        <ArtifactStat label="Reviewed" value={state.history.length} />
      </div>

      <p className="mt-4 border-t border-white/10 pt-4 text-caption text-panel-foreground/70">
        {artifactLine}
      </p>

      <div className="mt-4 border-t border-white/10 pt-4">
        <a
          href="https://iambetterthanme.com/shop"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-full bg-background px-5 py-2.5 text-caption font-medium text-foreground transition-opacity hover:opacity-90"
        >
          Make it wearable&nbsp;&rarr;
        </a>
        <p className="mt-2 text-caption text-panel-foreground/55">
          Opens IABTM&apos;s shop in a new tab.
        </p>
      </div>
    </section>
  );
}

function ArtifactStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <div className="text-micro text-panel-foreground/45">{label}</div>
      <div className="mt-1 text-subtitle tabular-nums text-panel-foreground">{value}</div>
    </div>
  );
}

function getAcceptedChannelSummary(state: EngineState): {
  topChannels: { channel: IabtmChannel; count: number }[];
  totalChannels: number;
} {
  const counts = new Map<IabtmChannel, { count: number; order: number }>();

  state.accepted.forEach((card, index) => {
    if (!card.channel) return;
    const existing = counts.get(card.channel);
    if (existing) {
      existing.count += 1;
      return;
    }
    counts.set(card.channel, { count: 1, order: index });
  });

  const ranked = Array.from(counts.entries())
    .map(([channel, value]) => ({ channel, ...value }))
    .sort((a, b) => b.count - a.count || a.order - b.order);

  return {
    topChannels: ranked.slice(0, 3).map(({ channel, count }) => ({ channel, count })),
    totalChannels: ranked.length,
  };
}

function getAttributeShift(state: EngineState): { current: string; imagined: string } | null {
  const current = state.lastReading?.currentSelf[0];
  const imagined = state.lastReading?.imaginedSelf[0];
  if (!current || !imagined) return null;
  return { current, imagined };
}

function buildArtifactLine({
  acceptedCount,
  savedCount,
  reviewedCount,
  channelCount,
}: {
  acceptedCount: number;
  savedCount: number;
  reviewedCount: number;
  channelCount: number;
}): string {
  if (channelCount > 0) {
    return `${formatCount(acceptedCount, "accepted quest")}. ${formatCount(channelCount, "channel")}. This is what you actually chose.`;
  }

  return `${formatCount(acceptedCount, "accepted quest")}. ${formatCount(savedCount, "saved item")}. ${formatCount(reviewedCount, "reviewed card")}.`;
}

function formatCount(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}
