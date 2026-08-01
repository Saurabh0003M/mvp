"use client";

import { motion, AnimatePresence } from "framer-motion";
import { type UserProfile, type EngineState, CATEGORY_ACCENTS } from "@/lib/engine";
import { X, Check, Bookmark, ChevronRight } from "lucide-react";

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
