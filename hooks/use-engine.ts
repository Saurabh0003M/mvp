"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import {
  type EngineState,
  type UserProfile,
  type SwipeDirection,
  type Insight,
  type Recommendation,
  RECOMMENDATIONS,
  createEngine,
  applySwipe,
  applyInsight,
  applyVoiceIntent,
  detectInsight,
  reSurface,
} from "@/lib/engine";
import { compressCognitiveState } from "@/lib/cognitive";
import { type VoiceReading } from "@/lib/voice";
import { useEnginePersistence } from "@/hooks/use-engine-persistence";

export interface CoachMessage {
  role: "user" | "coach";
  text: string;
}

const INSIGHT_COOLDOWN_MS = 4000;

export function useEngine() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [state, setState] = useState<EngineState | null>(null);
  const [activeInsight, setActiveInsight] = useState<Insight | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [reading, setReading] = useState<VoiceReading | null>(null);
  const lastInsightAt = useRef(0);

  // Optional Supabase mirror. When unconfigured every method is a no-op, so the
  // engine below behaves exactly as it did before persistence existed.
  const persistence = useEnginePersistence();

  // Compressed Cognitive State — rebuilt from scratch each turn (never
  // appended), so it stays O(1) in session length. Drives the wellbeing radar
  // and the corrective-pivot banner.
  const ccs = useMemo(
    () => (state && profile ? compressCognitiveState(state.history, profile, RECOMMENDATIONS) : null),
    [state, profile]
  );

  const start = useCallback((p: UserProfile) => {
    setProfile(p);
    setState(createEngine(p));
    // Mirror the profile to Supabase (no-op when unconfigured).
    persistence.persistProfile(p);
  }, [persistence]);

  const swipe = useCallback(
    (card: Recommendation, direction: SwipeDirection) => {
      if (!state || !profile) return;
      const next = applySwipe(state, card, direction, profile);
      setState(next);
      // Mirror the swipe to the interactions timeline (no-op when unconfigured).
      persistence.persistSwipe(card, direction, profile);

      const now = Date.now();
      if (now - lastInsightAt.current > INSIGHT_COOLDOWN_MS) {
        const insight = detectInsight(next, profile);
        if (insight) {
          setActiveInsight(insight);
          lastInsightAt.current = now;
        }
      }
    },
    [state, profile, persistence]
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

  // The conversational coach: a spoken/typed transcript is extracted into a
  // VoiceReading that visibly re-weights the engine, and the coach replies with
  // a curiosity-inducing question grounded in that reading.
  const converse = useCallback(
    (transcript: string) => {
      if (!state || !profile || !transcript.trim()) return;
      const text = transcript.trim();
      setMessages((m) => [...m, { role: "user", text }]);
      const { state: next, reading: r } = applyVoiceIntent(state, text, profile);
      setState(next);
      setReading(r);
      setMessages((m) => [...m, { role: "coach", text: r.coachReply }]);
    },
    [state, profile]
  );

  const dismissInsight = useCallback(() => {
    if (!state || !activeInsight) return;
    setState({
      ...state,
      dismissedInsights: new Set(Array.from(state.dismissedInsights).concat(activeInsight.id)),
    });
    setActiveInsight(null);
  }, [state, activeInsight]);

  // Record that accepted content was actually finished — the strongest signal.
  // Optional: the UI can call this from the content viewer's "done" action. It
  // is a pure persistence side-effect and does not touch in-memory engine state.
  const recordContentCompletion = useCallback(
    (card: Recommendation, completionTimeMs?: number) => {
      if (!profile) return;
      persistence.persistCompletion(card, profile, completionTimeMs);
    },
    [profile, persistence]
  );

  return {
    profile,
    state,
    ccs,
    activeInsight,
    toast,
    messages,
    reading,
    start,
    swipe,
    resurface,
    converse,
    applyActiveInsight,
    dismissInsight,
    // Persistence surface (harmless when Supabase is unconfigured).
    recordContentCompletion,
    persistenceEnabled: persistence.enabled,
    persistenceReady: persistence.ready,
  };
}
