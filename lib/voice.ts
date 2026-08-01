// ============================================================================
// Voice intent extraction — the "Wispr" conversational extractor.
// ----------------------------------------------------------------------------
// Turns a free-form spoken/typed transcript into a structured reading the
// recommendation engine can act on. Deliberately deterministic and
// dependency-free (no network, no LLM) so the live demo is reproducible: the
// same sentence always produces the same engine shift.
//
// It speaks IABTM's own vocabulary — mapping the "Attributes of Current Self"
// a user voices (Burnt Out, Anxious, Stuck) onto the "Attributes of Self You
// Imagine" (Recharged, Calm, Unstoppable) — and converts that into concrete
// category/format signals. A production build would swap extractIntent() for a
// Groq call returning the same VoiceReading shape; nothing downstream changes.
// ============================================================================

import { type Category, type Format, type UserProfile } from "./taxonomy";

export interface VoiceReading {
  transcript: string;
  /** Content categories the transcript points at. */
  categories: Category[];
  /**
   * The corrective mode the words call for. This — not raw keyword matching —
   * drives the format shift, so a *negative* mention ("no energy for a big
   * project") never gets read as wanting projects.
   *  - restore: low energy / burnout → lighter content, ease off building.
   *  - execute: consuming without doing → push toward shipping something.
   *  - focus:   high energy → lean into deeper project/reading work.
   *  - neutral: a plain topic ask with no strong state signal.
   */
  mode: "restore" | "execute" | "focus" | "neutral";
  /** Coarse energy read, kept for display. */
  energy: "low" | "medium" | "high";
  /** IABTM "Current Self" attributes detected, e.g. ["Burnt Out"]. */
  currentSelf: string[];
  /** IABTM "Self You Imagine" attributes — voiced or inferred from current. */
  imaginedSelf: string[];
  /** The single format to steer toward, resolved from mode (not raw keywords). */
  formatFocus: Format | null;
  /** Curiosity-inducing coach reply, grounded in the reading, ending in a question. */
  coachReply: string;
  at: number;
}

const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  "AI/ML": ["machine learning", "a.i", " ai ", "llm", "gpt", "neural", "rag", "transformer", "fine-tun", "model"],
  Cybersecurity: ["security", "cyber", "hacking", "hack", "ctf", "exploit", "network", "malware", "pentest"],
  "Web Dev": ["web dev", "frontend", "front-end", "backend", "back-end", "react", "css", "javascript", "fullstack", "full-stack", "website", "next.js"],
  Basketball: ["basketball", "shooting", "shoot", "dribble", "court", "hoop", "nba", "jump shot", "layup"],
  Design: ["design", " ux", " ui", "figma", "typography", "layout", "visual", "interface", "aesthetic"],
  Business: ["business", "startup", "marketing", "pricing", "strategy", "customer", "sales", "founder", "revenue"],
  "Data Science": ["data science", "sql", "pandas", "dataset", "analytics", "statistics", "kaggle", "visualization"],
  "Creative Writing": ["writing", "write", "story", "fiction", "essay", "poetry", "poem", "narrative", "screenplay"],
};

// Current-self keyword -> IABTM label. Presence of any means "low energy".
const LOW_ENERGY: Record<string, string> = {
  "burnt out": "Burnt Out",
  "burned out": "Burnt Out",
  burnout: "Burnt Out",
  exhausted: "Exhausted",
  tired: "Tired",
  drained: "Depleted",
  depleted: "Depleted",
  "no energy": "Depleted",
  "low energy": "Depleted",
  overwhelmed: "Overwhelmed",
  stressed: "Stressed",
  anxious: "Anxious",
  numb: "Numb",
  foggy: "Foggy",
  fatigued: "Fatigued",
  sluggish: "Sluggish",
  unmotivated: "Unmotivated",
  lazy: "Lazy",
  stuck: "Stuck",
  frustrated: "Frustrated",
  stagnant: "Stagnant",
  procrastinat: "Procrastination",
  distracted: "Distracted",
  scattered: "Scattered",
  overstimulated: "Overstimulated",
  restless: "Restless",
  "can't focus": "Unfocused",
  "cant focus": "Unfocused",
};

const HIGH_ENERGY: Record<string, string> = {
  motivated: "Motivated",
  excited: "Energized",
  energized: "Energized",
  energetic: "Energetic",
  ready: "Motivated",
  pumped: "Energized",
  "let's go": "Motivated",
  "lets go": "Motivated",
  "fired up": "Energized",
  inspired: "Inspired",
};

const IMAGINED: Record<string, string> = {
  focused: "Focused",
  disciplined: "Disciplined",
  consistent: "Consistent",
  confident: "Confident",
  creative: "Creative",
  energized: "Energized",
  motivated: "Motivated",
  calm: "Calm",
  recharged: "Recharged",
  productive: "Productive",
  inspired: "Inspired",
  curious: "Curious",
  organized: "Organized",
  grounded: "Grounded",
  balanced: "Balanced",
};

// Where a current-self state wants to go, when the user didn't name it.
const CURRENT_TO_IMAGINED: Record<string, string> = {
  "Burnt Out": "Recharged",
  Exhausted: "Rested",
  Tired: "Rested",
  Depleted: "Nourished",
  Overwhelmed: "Calm",
  Stressed: "Calm",
  Anxious: "Grounded",
  Foggy: "Focused",
  Fatigued: "Rested",
  Sluggish: "Energized",
  Unmotivated: "Motivated",
  Lazy: "Disciplined",
  Stuck: "Unstoppable",
  Frustrated: "Composed",
  Stagnant: "Growing",
  Procrastination: "Disciplined",
  Distracted: "Focused",
  Scattered: "Centered",
  Overstimulated: "Serene",
  Restless: "Steady",
  Numb: "Present",
  Unfocused: "Focused",
};

// Light-format cues only. We deliberately do NOT keyword-match "project"/"build"
// as a *want*, because those words most often appear in the negative ("no
// energy for a big project", "I never build anything"). Project intent is
// inferred from mode instead.
const LIGHT_FORMAT_CUES: { format: Format; words: string[] }[] = [
  { format: "video", words: ["watch", "video", "youtube"] },
  { format: "bite", words: ["quick", "short", "small", "light", "bite", "10 minute", "ten minute", "5 minute", "five minute"] },
  { format: "read", words: ["read an article", "read a", "article", "paper", "book"] },
];

// "I consume but never act" — the execution-gap signal. Takes priority over a
// low-energy read: the answer is to build, not to rest.
const EXECUTION_CUES = [
  "but i never build",
  "but never build",
  "never actually build",
  "not building",
  "keep watching",
  "keep reading",
  "watch tutorials",
  "watching tutorials",
  "tutorial hell",
  "just watching",
  "just watch",
  "over-consum",
  "overconsum",
  "never finish",
  "never ship",
  "don't apply",
  "dont apply",
];

function detect(haystack: string, table: Record<string, string>): string[] {
  const found: string[] = [];
  for (const [needle, label] of Object.entries(table)) {
    if (haystack.includes(needle) && !found.includes(label)) found.push(label);
  }
  return found;
}

export function extractIntent(transcript: string, profile: UserProfile): VoiceReading {
  const text = ` ${transcript.toLowerCase()} `;

  const categories: Category[] = [];
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS) as [Category, string[]][]) {
    if (words.some((w) => text.includes(w))) categories.push(cat);
  }

  const currentSelf = detect(text, LOW_ENERGY);
  const highSelf = detect(text, HIGH_ENERGY);
  const imaginedVoiced = detect(text, IMAGINED);

  const executionGap = EXECUTION_CUES.some((c) => text.includes(c));
  const lowEnergy = currentSelf.length > 0;
  const highEnergy = !lowEnergy && highSelf.length > 0;

  // Mode is decided before formats, so a negated "project" never wins.
  const mode: VoiceReading["mode"] = executionGap
    ? "execute"
    : lowEnergy
    ? "restore"
    : highEnergy
    ? "focus"
    : "neutral";

  const energy: VoiceReading["energy"] =
    mode === "restore" ? "low" : mode === "focus" ? "high" : "medium";

  // Current/imagined selves in IABTM's vocabulary.
  if (executionGap && currentSelf.length === 0) currentSelf.push("Over-consuming");
  const imaginedSelf = [...imaginedVoiced];
  if (mode === "focus") for (const h of highSelf) if (!imaginedSelf.includes(h)) imaginedSelf.push(h);
  for (const c of currentSelf) {
    const target = CURRENT_TO_IMAGINED[c];
    if (target && !imaginedSelf.includes(target)) imaginedSelf.push(target);
  }
  if (mode === "execute" && !imaginedSelf.includes("Disciplined")) imaginedSelf.push("Disciplined");

  // Format focus is resolved from mode, not raw keywords.
  let formatFocus: Format | null = null;
  if (mode === "restore") {
    formatFocus = "video";
  } else if (mode === "execute") {
    formatFocus = "project";
  } else {
    for (const cue of LIGHT_FORMAT_CUES) {
      if (cue.words.some((w) => text.includes(w))) {
        formatFocus = cue.format;
        break;
      }
    }
  }

  return {
    transcript: transcript.trim(),
    categories,
    mode,
    energy,
    currentSelf,
    imaginedSelf,
    formatFocus,
    coachReply: buildCoachReply({ categories, mode, currentSelf, imaginedSelf }, profile),
    at: Date.now(),
  };
}

function buildCoachReply(
  r: Pick<VoiceReading, "categories" | "mode" | "currentSelf" | "imaginedSelf">,
  profile: UserProfile
): string {
  const topic = r.categories[0];
  const want = r.imaginedSelf[0];

  if (r.mode === "execute") {
    return `You've clearly got the input — the gap is output, not knowledge. What if we turned one thing you've been meaning to learn into something small you actually ship today? Which idea has been sitting the longest?`;
  }

  if (r.mode === "restore") {
    const named = r.currentSelf[0] ? r.currentSelf[0].toLowerCase() : "worn down";
    return `Being ${named} is real, and pushing harder rarely fixes it. We can keep today light${
      topic ? ` — maybe a short watch on ${topic}` : " — something small and restorative"
    } instead of a heavy build. What would feel restoring right now, not just productive?`;
  }

  if (r.mode === "focus") {
    return `I love that momentum${want ? ` toward feeling ${want.toLowerCase()}` : ""}. Let's aim it at ${
      profile.aspiration || "your goal"
    }. Do you want to ship one small thing today, or go deep on a single hard idea?`;
  }

  if (topic) {
    return `Got it — ${topic}. Before I line things up: are you trying to *build* something concrete, or *explore* the space first to see what actually grabs you?`;
  }

  return `Tell me a little more about where your head is right now — are you reaching for something new, or trying to get unstuck on ${
    profile.aspiration || "what you're working toward"
  }?`;
}
