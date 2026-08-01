"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { UserProfile, Category, Difficulty, LearningStyle } from "@/lib/engine";

const EASE = [0.22, 1, 0.36, 1] as const;

const ASPIRATION_SUGGESTIONS = [
  "Backend Engineer",
  "Data Scientist",
  "Product Designer",
  "Security Researcher",
  "AI Engineer",
  "Frontend Engineer",
  "DevOps Engineer",
  "UX Researcher",
  "Technical Writer",
  "Founder",
];

const INTEREST_OPTIONS: { label: Category; hint: string }[] = [
  { label: "AI/ML", hint: "Models & ML" },
  { label: "Cybersecurity", hint: "Offense & defense" },
  { label: "Web Dev", hint: "Front & back" },
  { label: "Basketball", hint: "On-court skill" },
  { label: "Design", hint: "Craft & systems" },
  { label: "Business", hint: "Strategy & ships" },
  { label: "Data Science", hint: "Analysis & SQL" },
  { label: "Creative Writing", hint: "Prose & story" },
];

const EXPERIENCE_LEVELS: { value: Difficulty; desc: string }[] = [
  { value: "Beginner", desc: "New to the field" },
  { value: "Intermediate", desc: "Some hands-on time" },
  { value: "Advanced", desc: "Deep, practiced knowledge" },
];

const LEARNING_STYLES: { value: LearningStyle; label: string; desc: string }[] = [
  { value: "project", label: "Project-based", desc: "Learn by building" },
  { value: "read", label: "Reading", desc: "Articles & papers" },
  { value: "video", label: "Video", desc: "Watch & absorb" },
  { value: "bite", label: "Bite-sized", desc: "Short, focused reps" },
];

const TIME_OPTIONS: { value: 15 | 30 | 45 | 60; label: string; sub: string }[] = [
  { value: 15, label: "15 min", sub: "A focused coffee break" },
  { value: 30, label: "30 min", sub: "A deliberate session" },
  { value: 45, label: "45 min", sub: "A solid deep-work block" },
  { value: 60, label: "60 min", sub: "Deep work, uninterrupted" },
];

interface Props {
  onComplete: (profile: UserProfile) => void;
}

export function OnboardingFlow({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [aspiration, setAspiration] = useState("");
  const [interests, setInterests] = useState<Category[]>([]);
  const [experience, setExperience] = useState<Difficulty | null>(null);
  const [learningStyle, setLearningStyle] = useState<LearningStyle | null>(null);
  const [dailyTime, setDailyTime] = useState<15 | 30 | 45 | 60 | null>(null);
  const [calibrating, setCalibrating] = useState(false);

  const totalSteps = 4;
  const advancingRef = useRef(false);

  const canProceed = useCallback(() => {
    switch (step) {
      case 0: return aspiration.trim().length > 0;
      case 1: return interests.length > 0;
      case 2: return experience !== null && learningStyle !== null;
      case 3: return dailyTime !== null;
      default: return false;
    }
  }, [step, aspiration, interests, experience, learningStyle, dailyTime]);

  const handleNext = useCallback(() => {
    if (advancingRef.current) return;
    if (!canProceed()) return;
    advancingRef.current = true;

    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
      setTimeout(() => { advancingRef.current = false; }, 350);
    } else {
      setCalibrating(true);
      setTimeout(() => {
        onComplete({
          aspiration: aspiration.trim(),
          interests,
          experience: experience!,
          learningStyle: learningStyle!,
          dailyTime: dailyTime!,
        });
      }, 1600);
    }
  }, [step, totalSteps, canProceed, onComplete, aspiration, interests, experience, learningStyle, dailyTime]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.defaultPrevented || calibrating) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      e.preventDefault();
      handleNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleNext, calibrating]);

  const toggleInterest = (cat: Category) => {
    setInterests((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  if (calibrating) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-sunfade bg-grain">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="flex flex-col items-center gap-6"
        >
          <div className="relative h-20 w-20">
            <div className="absolute inset-0 rounded-full border border-border" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-foreground/80 animate-spin" style={{ animationDuration: "0.9s" }} />
          </div>
          <div className="space-y-2 text-center">
            <div className="text-title">Calibrating your recommendation profile</div>
            <div className="flex gap-1.5 justify-center">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-foreground/40"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-sunfade bg-grain">
      {/* Brand mark */}
      <div className="flex items-center gap-2.5 px-6 pt-6 sm:px-10">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background">
          <span className="text-caption font-semibold">A</span>
        </div>
        <span className="text-subtitle font-semibold tracking-tight">Ascend</span>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 px-6 pt-6 sm:px-10">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-foreground"
              initial={false}
              animate={{ width: i < step ? "100%" : i === step ? "40%" : "0%" }}
              transition={{ duration: 0.35, ease: EASE }}
            />
          </div>
        ))}
      </div>

      {/* Scrollable content area — keeps the nav bar always visible */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 sm:px-10">
          <div className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center py-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                {step === 0 && (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="text-micro text-muted-foreground">Step 1 of 4 — Aspiration</div>
                      <h1 className="text-balance text-display">Who do you want to become?</h1>
                      <p className="text-body text-muted-foreground">
                        Name the person you&apos;re growing toward. This anchors every recommendation.
                      </p>
                    </div>
                    <input
                      autoFocus
                      value={aspiration}
                      onChange={(e) => setAspiration(e.target.value)}
                      placeholder="e.g. Backend Engineer"
                      className="w-full rounded-2xl border border-border bg-card px-5 py-4 text-title text-foreground shadow-soft outline-none transition-all placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:shadow-card"
                    />
                    <div className="space-y-3">
                      <div className="text-caption text-muted-foreground">Or start with one of these</div>
                      <div className="flex flex-wrap gap-2">
                        {ASPIRATION_SUGGESTIONS.map((s) => (
                          <button
                            key={s}
                            onClick={() => setAspiration(s)}
                            className={cn(
                              "rounded-full border px-4 py-2 text-caption transition-all",
                              aspiration === s
                                ? "border-foreground bg-foreground text-background"
                                : "border-border bg-card text-foreground hover:border-foreground/40 hover:bg-accent"
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="text-micro text-muted-foreground">Step 2 of 4 — Interests</div>
                      <h1 className="text-balance text-headline">What captures your curiosity?</h1>
                      <p className="text-body text-muted-foreground">
                        Select a few areas. The engine starts here and evolves with every swipe.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {INTEREST_OPTIONS.map((opt, idx) => {
                        const selected = interests.includes(opt.label);
                        return (
                          <motion.button
                            key={`${opt.label}-${idx}`}
                            onClick={() => toggleInterest(opt.label)}
                            whileTap={{ scale: 0.96 }}
                            className={cn(
                              "rounded-2xl border px-3 py-3 text-left transition-all",
                              selected
                                ? "border-foreground bg-foreground text-background shadow-soft"
                                : "border-border bg-card text-foreground hover:border-foreground/30 hover:bg-accent"
                            )}
                          >
                            <div className="text-subtitle leading-tight">{opt.label}</div>
                            <div className={cn("text-caption mt-0.5", selected ? "text-background/70" : "text-muted-foreground")}>
                              {opt.hint}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <div className="text-micro text-muted-foreground">Step 3 of 4 — Experience & Style</div>
                      <h1 className="text-balance text-headline">How do you learn best?</h1>
                    </div>
                    <div className="space-y-3">
                      <div className="text-caption text-muted-foreground">Experience level</div>
                      <div className="grid grid-cols-3 gap-2.5">
                        {EXPERIENCE_LEVELS.map((lvl) => (
                          <button
                            key={lvl.value}
                            onClick={() => setExperience(lvl.value)}
                            className={cn(
                              "rounded-2xl border p-3.5 text-left transition-all",
                              experience === lvl.value
                                ? "border-foreground bg-foreground text-background shadow-soft"
                                : "border-border bg-card hover:border-foreground/30 hover:bg-accent"
                            )}
                          >
                            <div className="text-subtitle">{lvl.value}</div>
                            <div className={cn("text-caption mt-0.5", experience === lvl.value ? "text-background/70" : "text-muted-foreground")}>
                              {lvl.desc}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="text-caption text-muted-foreground">Learning style</div>
                      <div className="grid grid-cols-2 gap-2.5">
                        {LEARNING_STYLES.map((s) => (
                          <button
                            key={s.value}
                            onClick={() => setLearningStyle(s.value)}
                            className={cn(
                              "rounded-2xl border p-3.5 text-left transition-all",
                              learningStyle === s.value
                                ? "border-foreground bg-foreground text-background shadow-soft"
                                : "border-border bg-card hover:border-foreground/30 hover:bg-accent"
                            )}
                          >
                            <div className="text-subtitle">{s.label}</div>
                            <div className={cn("text-caption mt-0.5", learningStyle === s.value ? "text-background/70" : "text-muted-foreground")}>
                              {s.desc}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="text-micro text-muted-foreground">Step 4 of 4 — Daily time</div>
                      <h1 className="text-balance text-headline">How much time per day?</h1>
                      <p className="text-body text-muted-foreground">
                        Quests are filtered to fit this window. You can adjust later.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {TIME_OPTIONS.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setDailyTime(t.value)}
                          className={cn(
                            "rounded-2xl border p-4 text-center transition-all",
                            dailyTime === t.value
                              ? "border-foreground bg-foreground text-background shadow-soft"
                              : "border-border bg-card hover:border-foreground/30 hover:bg-accent"
                          )}
                        >
                          <div className="text-headline leading-none">{t.label}</div>
                          <div className={cn("text-caption mt-2", dailyTime === t.value ? "text-background/70" : "text-muted-foreground")}>
                            {t.sub}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Nav bar — pinned at the bottom, always visible */}
        <div className="shrink-0 border-t border-border/60 bg-sunfade/80 px-6 py-4 backdrop-blur-sm sm:px-10">
          <div className="mx-auto flex w-full max-w-xl items-center justify-between">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className={cn(
                "text-caption text-muted-foreground transition-colors hover:text-foreground",
                step === 0 && "pointer-events-none opacity-0"
              )}
            >
              Back
            </button>
            <div className="flex items-center gap-3">
              {canProceed() && (
                <span className="hidden text-caption text-muted-foreground sm:block">
                  Press <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-micro">Enter</kbd>
                </span>
              )}
              <motion.button
                whileTap={{ scale: 0.97 }}
                disabled={!canProceed()}
                onClick={handleNext}
                className={cn(
                  "rounded-full px-6 py-3 text-subtitle transition-all",
                  canProceed()
                    ? "bg-foreground text-background shadow-soft hover:shadow-card"
                    : "cursor-not-allowed bg-muted text-muted-foreground"
                )}
              >
                {step === totalSteps - 1 ? "Begin" : "Continue"}
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
