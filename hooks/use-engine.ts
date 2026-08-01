"use client";

import { useState, useCallback, useRef } from "react";
import {
  type EngineState,
  type UserProfile,
  type SwipeDirection,
  type Insight,
  type Recommendation,
  createEngine,
  applySwipe,
  applyInsight,
  detectInsight,
  reSurface,
} from "@/lib/engine";

const INSIGHT_COOLDOWN_MS = 4000;

export function useEngine() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [state, setState] = useState<EngineState | null>(null);
  const [activeInsight, setActiveInsight] = useState<Insight | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const lastInsightAt = useRef(0);

  const start = useCallback((p: UserProfile) => {
    setProfile(p);
    setState(createEngine(p));
  }, []);

  const swipe = useCallback(
    (card: Recommendation, direction: SwipeDirection) => {
      if (!state || !profile) return;
      const next = applySwipe(state, card, direction, profile);
      setState(next);

      const now = Date.now();
      if (now - lastInsightAt.current > INSIGHT_COOLDOWN_MS) {
        const insight = detectInsight(next, profile);
        if (insight) {
          setActiveInsight(insight);
          lastInsightAt.current = now;
        }
      }
    },
    [state, profile]
  );

  const resurface = useCallback(
    (cardId: string) => {
      if (!state || !profile) return;
      setState(reSurface(state, cardId, profile));
    },
    [state, profile]
  );

  const applyActiveInsight = useCallback(() => {
    if (!state || !profile || !activeInsight) return;
    setState(applyInsight(state, activeInsight, profile));
    setActiveInsight(null);
    setToast("Recommendations updated");
    setTimeout(() => setToast(null), 2200);
  }, [state, profile, activeInsight]);

  const dismissInsight = useCallback(() => {
    if (!state || !activeInsight) return;
    setState({
      ...state,
      dismissedInsights: new Set(Array.from(state.dismissedInsights).concat(activeInsight.id)),
    });
    setActiveInsight(null);
  }, [state, activeInsight]);

  return {
    profile,
    state,
    activeInsight,
    toast,
    start,
    swipe,
    resurface,
    applyActiveInsight,
    dismissInsight,
  };
}
