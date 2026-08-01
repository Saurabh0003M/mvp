"use client";

import { motion } from "framer-motion";
import { type EngineState, type UserProfile, topWeights } from "@/lib/engine";

const EASE = [0.22, 1, 0.36, 1] as const;

interface Props {
  state: EngineState;
  profile: UserProfile;
  prevWeights: { label: string; value: number }[];
}

export function TasteProfileRail({ state, profile, prevWeights }: Props) {
  const bars = topWeights(state, profile);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-micro text-muted-foreground">Taste Profile</div>
            <div className="text-subtitle mt-0.5">Live weights</div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-pulse" />
            <span className="text-caption whitespace-nowrap text-muted-foreground">Updating</span>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          {bars.map((bar) => {
            const prev = prevWeights.find((p) => p.label === bar.label)?.value ?? bar.value;
            const rising = bar.value > prev;
            const falling = bar.value < prev;
            return (
              <div key={bar.label}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-caption truncate text-foreground/80">{bar.label}</span>
                  <CountUpValue value={bar.value} rising={rising} falling={falling} accent={bar.accent} />
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: bar.accent }}
                    initial={false}
                    animate={{ width: `${bar.value}%` }}
                    transition={{ duration: 0.45, ease: EASE }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
          <Stat value={state.history.length} label="Swipes" />
          <Stat value={state.accepted.length} label="Accepted" />
          <Stat value={state.later.length} label="Saved" />
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="text-subtitle tabular-nums leading-none">{value}</div>
      <div className="text-micro mt-1 whitespace-nowrap text-muted-foreground">{label}</div>
    </div>
  );
}

function CountUpValue({
  value,
  rising,
  falling,
  accent,
}: {
  value: number;
  rising: boolean;
  falling: boolean;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-1">
      {rising && <span className="text-[10px]" style={{ color: accent }}>▲</span>}
      {falling && <span className="text-[10px]" style={{ color: accent }}>▼</span>}
      <motion.span
        key={value}
        initial={{ opacity: 0.4, y: -2 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: EASE }}
        className="text-caption font-semibold tabular-nums"
        style={{ color: rising || falling ? accent : undefined }}
      >
        {value}
      </motion.span>
    </div>
  );
}
