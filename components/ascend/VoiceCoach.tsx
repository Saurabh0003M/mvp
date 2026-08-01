"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, X, ArrowUp, Sparkles } from "lucide-react";
import { type CoachMessage } from "@/hooks/use-engine";
import { type VoiceReading } from "@/lib/voice";

const EASE = [0.22, 1, 0.36, 1] as const;

const EXAMPLES = [
  "I'm burnt out from coding today, I don't have energy for a big project.",
  "I'm fired up — I want to go deep on AI and machine learning.",
  "I keep watching tutorials but I never actually build anything.",
  "I feel stuck and scattered, not sure what to focus on for design.",
];

interface Props {
  messages: CoachMessage[];
  reading: VoiceReading | null;
  onConverse: (text: string) => void;
}

export function VoiceCoach({ messages, reading, onConverse }: Props) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [text, setText] = useState("");
  const [pill, setPill] = useState<VoiceReading | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  // Surface the detected Current -> Imagined state as a transient pill.
  useEffect(() => {
    if (!reading) return;
    setPill(reading);
    const t = setTimeout(() => setPill(null), 3600);
    return () => clearTimeout(t);
  }, [reading]);

  // Keep the newest turn in view.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, extracting]);

  // Escape closes the coach.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setListening(false);
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function startListening() {
    setListening(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function stopListening() {
    if (!listening) return;
    setListening(false);
    submit();
  }

  function submit() {
    const value = text.trim();
    if (!value) return;
    setExtracting(true);
    setText("");
    window.setTimeout(() => {
      onConverse(value);
      setExtracting(false);
    }, 850);
  }

  const currentLabel =
    pill?.currentSelf[0] ?? (pill?.energy === "high" ? "Energized" : "Exploring");
  const imaginedLabel = pill?.imaginedSelf[0] ?? "Recharged";

  return (
    <>
      {/* Floating action button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.35, ease: EASE }}
            onClick={() => setOpen(true)}
            aria-label="Open the coach and think out loud"
            className="group fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-full border border-border bg-card/90 py-3 pl-3 pr-5 shadow-soft backdrop-blur-xl transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:bottom-6 sm:right-6"
          >
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background">
              <Mic className="h-4 w-4" />
              <motion.span
                className="absolute inset-0 rounded-full bg-foreground/25"
                animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
              />
            </span>
            <span className="text-caption text-foreground/80">Think out loud</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Conversational overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            data-overlay-open
            role="dialog"
            aria-modal="true"
            aria-label="Coach"
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            {/* Backdrop */}
            <motion.button
              aria-label="Close coach"
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
              transition={{ duration: 0.3 }}
              onClick={() => {
                setListening(false);
                setOpen(false);
              }}
              className={`absolute inset-0 bg-background/60 backdrop-blur-md transition-opacity ${
                listening ? "bg-background/80" : ""
              }`}
            />

            {/* Panel */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 40 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.4, ease: EASE }}
              className="relative m-0 flex h-[78vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-soft sm:m-4 sm:h-[560px] sm:rounded-3xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <div className="text-subtitle leading-none">Coach</div>
                    <div className="text-micro mt-1 text-muted-foreground">Think out loud — I&apos;ll steer your feed</div>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Thread */}
              <div ref={threadRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                {messages.length === 0 && (
                  <div className="mt-2">
                    <p className="text-body text-foreground/80">
                      What&apos;s on your mind right now? Hold the mic and just talk — no need to
                      know what you want. I&apos;ll listen for how you&apos;re feeling and quietly
                      re-tune your recommendations.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {EXAMPLES.map((ex) => (
                        <button
                          key={ex}
                          onClick={() => setText(ex)}
                          className="rounded-full border border-border px-3 py-1.5 text-left text-caption text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                        >
                          {ex.length > 42 ? ex.slice(0, 40) + "…" : ex}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <Bubble key={i} message={m} />
                ))}

                {extracting && (
                  <div className="flex items-center gap-2 text-caption text-muted-foreground">
                    <span className="flex gap-1">
                      <Dot delay={0} />
                      <Dot delay={0.15} />
                      <Dot delay={0.3} />
                    </span>
                    Extracting intent…
                  </div>
                )}
              </div>

              {/* Detected-state pill */}
              <AnimatePresence>
                {pill && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="mx-5 mb-1 flex items-center gap-2 rounded-xl border border-border bg-accent/60 px-3 py-2"
                  >
                    <span className="text-micro text-muted-foreground">State detected</span>
                    <span className="text-caption font-medium text-foreground">{currentLabel}</span>
                    <ArrowUp className="h-3 w-3 rotate-45 text-muted-foreground" />
                    <span className="text-caption font-medium text-foreground">{imaginedLabel}</span>
                    {pill.categories[0] && (
                      <span className="ml-auto rounded-full bg-background px-2 py-0.5 text-micro text-muted-foreground">
                        {pill.categories[0]}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Composer */}
              <div className="border-t border-border p-3">
                <div className="flex items-end gap-2">
                  <button
                    onPointerDown={startListening}
                    onPointerUp={stopListening}
                    onPointerLeave={stopListening}
                    className="relative flex h-11 w-11 shrink-0 select-none items-center justify-center rounded-full bg-foreground text-background transition-transform active:scale-95"
                    aria-label="Hold to think out loud"
                  >
                    <Mic className="h-4 w-4" />
                    <AnimatePresence>
                      {listening && (
                        <>
                          <motion.span
                            className="absolute inset-0 rounded-full border-2 border-foreground/40"
                            initial={{ scale: 1, opacity: 0.7 }}
                            animate={{ scale: 1.8, opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
                          />
                          <motion.span
                            className="absolute inset-0 rounded-full border-2 border-foreground/40"
                            initial={{ scale: 1, opacity: 0.7 }}
                            animate={{ scale: 1.8, opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut", delay: 0.6 }}
                          />
                        </>
                      )}
                    </AnimatePresence>
                  </button>

                  <div className="flex flex-1 items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2">
                    <textarea
                      ref={inputRef}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          submit();
                        }
                      }}
                      rows={1}
                      placeholder={listening ? "Listening… (Ctrl+Win dictates via Wispr)" : "Hold the mic, or type…"}
                      className="max-h-24 flex-1 resize-none bg-transparent text-caption text-foreground outline-none placeholder:text-muted-foreground"
                    />
                    <button
                      onClick={submit}
                      disabled={!text.trim()}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity disabled:opacity-30"
                      aria-label="Send"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Bubble({ message }: { message: CoachMessage }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-caption leading-relaxed ${
          isUser
            ? "bg-foreground text-background"
            : "border border-border bg-accent/50 text-foreground/90"
        }`}
      >
        {message.text}
      </div>
    </motion.div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 0.9, repeat: Infinity, delay }}
    />
  );
}
