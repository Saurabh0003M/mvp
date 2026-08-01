"use client";

import { motion } from "framer-motion";
import { type EngineState, type UserProfile, trajectory } from "@/lib/engine";
import { Compass } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

interface Props {
  state: EngineState;
  profile: UserProfile;
}

export function TrajectoryStrip({ state, profile }: Props) {
  const text = trajectory(state, profile);
  return (
    <motion.div
      key={text}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="flex items-center gap-2.5 rounded-full border border-border bg-card/60 px-4 py-2.5 backdrop-blur"
    >
      <Compass className="h-4 w-4 text-muted-foreground" />
      <span className="text-caption text-foreground/80">{text}</span>
    </motion.div>
  );
}
