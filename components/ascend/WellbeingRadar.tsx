"use client";

import { motion } from "framer-motion";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import {
  AXIS_ORDER,
  AXIS_LABELS,
  SCORE_MIN,
  SCORE_MAX,
  type CompressedCognitiveState,
  type RyffAxis,
} from "@/lib/cognitive";

const EASE = [0.22, 1, 0.36, 1] as const;

// Short labels so the six axes fit around a small radar.
const SHORT: Record<RyffAxis, string> = {
  autonomy: "Autonomy",
  environmentalMastery: "Mastery",
  personalGrowth: "Growth",
  positiveRelations: "Relations",
  purposeInLife: "Purpose",
  selfAcceptance: "Self-Accept",
};

export function WellbeingRadar({ ccs }: { ccs: CompressedCognitiveState }) {
  const data = AXIS_ORDER.map((a) => ({
    axis: SHORT[a],
    value: ccs.wellbeing[a],
  }));

  const avgConfidence =
    AXIS_ORDER.reduce((s, a) => s + ccs.confidence[a], 0) / AXIS_ORDER.length;

  const settled = avgConfidence >= 0.4;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="rounded-2xl border border-border bg-card p-5 shadow-soft"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-micro text-muted-foreground">Wellbeing</div>
          <div className="text-subtitle mt-0.5 whitespace-nowrap">What&apos;s growing</div>
        </div>
        <span className="text-caption shrink-0 whitespace-nowrap tabular-nums text-muted-foreground">
          {ccs.turn} {ccs.turn === 1 ? "choice" : "choices"}
        </span>
      </div>

      <div className="mt-2 h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            />
            <PolarRadiusAxis
              domain={[SCORE_MIN, SCORE_MAX]}
              tick={false}
              axisLine={false}
            />
            <Radar
              dataKey="value"
              stroke="hsl(var(--foreground))"
              strokeWidth={1.5}
              fill="hsl(var(--foreground))"
              fillOpacity={settled ? 0.14 : 0.06}
              isAnimationActive
              animationDuration={450}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-1 space-y-1.5">
        <div className="flex items-center justify-between gap-3 text-caption">
          <span className="shrink-0 text-muted-foreground">Strongest</span>
          <span className="truncate text-right text-foreground/80">{AXIS_LABELS[ccs.strongestAxis]}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-caption">
          <span className="shrink-0 whitespace-nowrap text-muted-foreground">Growth frontier</span>
          <span className="truncate text-right text-foreground/80">{AXIS_LABELS[ccs.weakestAxis]}</span>
        </div>
      </div>

      <p className="mt-4 border-t border-border pt-3 text-micro leading-relaxed text-muted-foreground">
        A behavioural estimate of Ryff&apos;s six dimensions of psychological
        wellbeing, inferred from your choices — {settled ? "settling in" : "still forming"} at{" "}
        {Math.round(avgConfidence * 100)}% confidence. An estimate, not a diagnosis.
      </p>
    </motion.div>
  );
}
