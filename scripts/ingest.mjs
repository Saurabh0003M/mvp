// ============================================================================
// Ascend content ingestion — real media, fetched from real APIs.
// ----------------------------------------------------------------------------
// Answers the host's question "where does the data come from?" with an actual
// pipeline rather than a hardcoded array.
//
// It ingests into IABTM'S OWN SIX CHANNELS — Film, Music, Art, Animation,
// Editorial, Print — because that is how the host's Curated Media section is
// organised, and their register is culture and human potential, not developer
// tutorials. Each item is normalised, given a curiosity hook, and frozen into
// data/corpus.json so the running app never needs the network.
//
//   node scripts/ingest.mjs
//
// Requires YOUTUBE_API_KEY in .env.local. Quota: search.list costs 100 units
// per call and the free tier is 10,000/day, so this stays well inside it.
//
// COMPLIANCE NOTE: we store only metadata (id, title, channel, thumbnail) and
// we never copy the media itself — playback happens in YouTube's own embedded
// player. YouTube's Developer Policies cap public-data retention at 30 days,
// so a production build re-runs this on a schedule rather than treating
// corpus.json as permanent.
// ============================================================================

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// --- tiny .env.local reader (no dependency) --------------------------------
function loadEnv() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
const env = { ...loadEnv(), ...process.env };
const KEY = env.YOUTUBE_API_KEY;

// ---------------------------------------------------------------------------
// The six IABTM channels, each with searches in the host's register:
// culture, craft and human potential — never "build a CRUD app".
// ---------------------------------------------------------------------------
const CHANNELS = [
  {
    channel: "Film",
    category: "Creative Writing",
    queries: [
      "video essay on storytelling craft",
      "documentary short about creative discipline",
      "cinematography breakdown visual storytelling",
    ],
  },
  {
    channel: "Music",
    category: "Design",
    queries: [
      "deep focus instrumental for concentration",
      "how music affects the brain focus",
      "ambient music for deep work",
    ],
  },
  {
    channel: "Art",
    category: "Design",
    queries: [
      "artist process studio practice documentary",
      "how great artists develop a personal style",
      "creative block how artists work through it",
    ],
  },
  {
    channel: "Animation",
    category: "Design",
    queries: [
      "principles of animation explained",
      "animation short film making of",
      "motion design principles tutorial",
    ],
  },
  {
    channel: "Editorial",
    category: "Business",
    queries: [
      "why self improvement culture is broken",
      "how identity shapes behaviour psychology",
      "attention economy explained essay",
    ],
  },
  {
    channel: "Print",
    category: "Creative Writing",
    queries: [
      "how to read more books deep reading",
      "writing habit daily practice authors",
      "magazine design typography craft",
    ],
  },
];

// Curiosity hooks, per channel. Deliberately NOT spliced from the title —
// interpolating a headline mid-sentence mangles capitalisation and reads
// machine-made. These open a loop the title then answers, which is the whole
// point: the card sells the gap, not the label.
const HOOKS = {
  Film: [
    "Every story you love uses this. Most people never notice.",
    "The edit is where the meaning actually gets made.",
    "Watch how they hold the shot one beat too long.",
    "Craft you can steal, in about ten minutes.",
  ],
  Music: [
    "Put this on. Come back in an hour and see what changed.",
    "Sound engineers use this to make a room disappear.",
    "No lyrics. Your brain stops competing for language.",
    "For the part of the day where thinking is hard.",
  ],
  Art: [
    "Style isn't found. It's the residue of a thousand decisions.",
    "How the work actually gets made, without the mythology.",
    "The blank page problem, solved by people who face it daily.",
    "Ten minutes inside somebody else's process.",
  ],
  Animation: [
    "Twelve rules explain almost every frame you've ever loved.",
    "Movement is timing. Timing is a decision.",
    "Why some motion feels alive and some feels dead.",
    "The craft hiding inside three seconds of screen time.",
  ],
  Editorial: [
    "You've felt this. It turns out it has a name.",
    "The comfortable version of this story is wrong.",
    "Worth the argument it'll start in your head.",
    "Most advice skips the part that actually matters.",
  ],
  Print: [
    "Reading more isn't about discipline. It's about design.",
    "The habit is smaller than you think it is.",
    "What people who write every day do differently.",
    "Slow down. That's the entire technique.",
  ],
};

/** ISO-8601 PT#M#S -> minutes (rounded up, min 1). */
function isoToMinutes(iso) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || "") || [];
  const h = Number(m[1] || 0), mi = Number(m[2] || 0), s = Number(m[3] || 0);
  return Math.max(1, Math.round(h * 60 + mi + s / 60));
}

async function api(path, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", KEY);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${path} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function ingestChannel({ channel, category, queries }) {
  const items = [];
  for (const q of queries) {
    let search;
    try {
      search = await api("search", {
        part: "snippet",
        q,
        type: "video",
        maxResults: "6",
        videoEmbeddable: "true",       // must be playable in our own player
        videoSyndicated: "true",
        relevanceLanguage: "en",
        safeSearch: "moderate",
      });
    } catch (e) {
      console.warn(`  ! search failed for "${q}": ${e.message}`);
      continue;
    }

    const ids = (search.items || []).map((i) => i.id.videoId).filter(Boolean);
    if (!ids.length) continue;

    const details = await api("videos", {
      part: "contentDetails,statistics,snippet",
      id: ids.join(","),
    });

    for (const v of details.items || []) {
      const mins = isoToMinutes(v.contentDetails?.duration);
      // Sanity bounds — drops mislabeled clips and multi-hour streams.
      if (mins < 2 || mins > 90) continue;
      const views = Number(v.statistics?.viewCount || 0);
      if (views < 1000) continue;                     // weak but real trust signal

      const title = v.snippet.title;
      const pool = HOOKS[channel];
      const hook = pool[items.length % pool.length];
      const isMusic = channel === "Music";

      items.push({
        id: `yt-${v.id}`,
        hook,
        title,
        description:
          (v.snippet.description || "").split("\n")[0].slice(0, 180) ||
          `From ${v.snippet.channelTitle}.`,
        category,
        channel,
        format: isMusic ? "bite" : mins <= 15 ? "video" : "read",
        difficulty: mins <= 10 ? "Beginner" : mins <= 30 ? "Intermediate" : "Advanced",
        duration: mins,
        tags: [channel.toLowerCase(), v.snippet.channelTitle.toLowerCase().slice(0, 24)],
        mediaKind: isMusic ? "music" : "video",
        embedUrl: `https://www.youtube.com/embed/${v.id}`,
        thumbnail:
          v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.medium?.url,
        source: "YouTube",
        sourceUrl: `https://www.youtube.com/watch?v=${v.id}`,
      });
    }
  }
  // De-dupe by id within the channel.
  const seen = new Set();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}

async function main() {
  if (!KEY) {
    console.error("Missing YOUTUBE_API_KEY (put it in mvp/.env.local).");
    process.exit(1);
  }
  console.log("Ingesting IABTM channels from YouTube…\n");

  const all = [];
  for (const c of CHANNELS) {
    process.stdout.write(`  ${c.channel.padEnd(10)} `);
    const items = await ingestChannel(c);
    all.push(...items);
    console.log(`${items.length} items`);
  }

  const byChannel = {};
  for (const i of all) byChannel[i.channel] = (byChannel[i.channel] || 0) + 1;

  mkdirSync(join(ROOT, "data"), { recursive: true });
  const out = {
    generatedAt: new Date().toISOString(),
    source: "YouTube Data API v3",
    note: "Metadata only. Playback uses YouTube's embedded player; nothing is re-hosted.",
    counts: byChannel,
    items: all,
  };
  writeFileSync(join(ROOT, "data", "corpus.json"), JSON.stringify(out, null, 2));

  console.log(`\n✓ ${all.length} items → data/corpus.json`);
  console.log(`  ${JSON.stringify(byChannel)}`);
}

main().catch((e) => {
  console.error("\nIngestion failed:", e.message);
  process.exit(1);
});
