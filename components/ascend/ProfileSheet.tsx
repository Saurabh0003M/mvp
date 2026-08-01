"use client";

import { motion, AnimatePresence } from "framer-motion";
import { type UserProfile, CATEGORY_ACCENTS } from "@/lib/engine";
import { type CompressedCognitiveState } from "@/lib/cognitive";
import { WellbeingRadar } from "./WellbeingRadar";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  profile: UserProfile;
  ccs: CompressedCognitiveState | null;
}

export function ProfileSheet({ open, onClose, profile, ccs }: Props) {
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
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            data-overlay-open
            role="dialog"
            aria-modal="true"
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-lifted"
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

              {ccs && <WellbeingRadar ccs={ccs} />}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
