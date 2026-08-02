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

import { createHash } from "node:crypto";
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
const WEBZ_KEY = env.WEBZ_API_KEY;

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

// Written article lane. These are deliberately limited to Editorial and Print,
// where IABTM's own Curated Media shape is article-first.
const WEBZ_CHANNELS = [
  {
    channel: "Editorial",
    category: "Business",
    queries: [
      `"self improvement culture" OR "identity and behaviour change"`,
      `"attention economy" OR "digital wellbeing"`,
      `"burnout recovery" OR "rest and productivity"`,
    ],
  },
  {
    channel: "Print",
    category: "Creative Writing",
    queries: [
      `"deep reading" OR "reading habit"`,
      `"writing practice" OR "creative discipline"`,
    ],
  },
];

// Curiosity hooks, per channel. Deliberately NOT spliced from the title:
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

async function webzApi(query) {
  const url = new URL("https://api.webz.io/newsApiLite");
  url.searchParams.set("token", WEBZ_KEY);
  url.searchParams.set("q", query);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Webz ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

function normalizeSpace(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function firstSentence(value) {
  const text = normalizeSpace(value).replace(/(^|\s)(\.{2,}|…)\s*/g, " ").trim();
  if (!text) return "";
  const m = /^(.+?[.!?])(?=\s|$)/.exec(text);
  const sentence = m && m[1].length >= 80 ? m[1] : text;
  return sentence.slice(0, 180).trim();
}

function wordCount(value) {
  const text = normalizeSpace(value);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function hashId(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function cleanTag(value) {
  return normalizeSpace(value).toLowerCase().slice(0, 32) || "web";
}

function isEnglishPost(post) {
  const raw = normalizeSpace(post.language || post.lang || post.thread?.language || post.thread?.lang);
  if (!raw) return true;
  const lang = raw.toLowerCase();
  return lang === "en" || lang === "english" || lang.startsWith("en-");
}

function postUrl(post) {
  return normalizeSpace(post.url || post.thread?.url || post.thread?.site_full);
}

function postImage(post) {
  return normalizeSpace(
    post.thread?.main_image ||
    post.thread?.image ||
    post.main_image ||
    post.mainImage ||
    post.image ||
    post.image_url
  );
}

function postText(post) {
  const candidates = [
    post.text,
    post.description,
    post.summary,
    post.highlightText,
    post.highlightThreadTitle,
  ].map(normalizeSpace).filter(Boolean);
  return candidates.find((candidate) => firstSentence(candidate).length >= 80) || candidates[0] || "";
}

function postSite(post, url) {
  const fromPost = normalizeSpace(post.thread?.site || post.site || post.source);
  if (fromPost) return fromPost;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "web";
  }
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

async function ingestWebzChannel({ channel, category, queries }, seenUrls) {
  const items = [];
  for (const q of queries) {
    let response;
    try {
      response = await webzApi(q);
    } catch (e) {
      console.warn(`  ! Webz failed for "${q}": ${e.message}`);
      continue;
    }

    for (const post of response.posts || []) {
      const title = normalizeSpace(post.title);
      const url = postUrl(post);
      const image = postImage(post);
      const text = postText(post);
      const excerpt = firstSentence(text);

      if (!title || !url) continue;
      if (seenUrls.has(url)) continue;
      if (!image) continue;
      if (!isEnglishPost(post)) continue;
      if (excerpt.length < 80) continue;

      seenUrls.add(url);
      const site = postSite(post, url);
      const pool = HOOKS[channel];
      const hook = pool[items.length % pool.length];

      items.push({
        id: `wz-${hashId(url)}`,
        hook,
        title,
        description: excerpt,
        category,
        channel,
        format: "read",
        difficulty: "Intermediate",
        duration: Math.max(3, Math.round(wordCount(text) / 200)),
        tags: [channel.toLowerCase(), cleanTag(site)],
        mediaKind: "article",
        embedUrl: url,
        thumbnail: image,
        source: "Article",
        sourceUrl: url,
      });
    }
  }
  return items;
}

async function main() {
  if (!KEY) {
    console.error("Missing YOUTUBE_API_KEY (put it in mvp/.env.local).");
    process.exit(1);
  }
  console.log("Ingesting IABTM channels from YouTube…\n");

  const all = [];
  const seenUrls = new Set();
  for (const c of CHANNELS) {
    process.stdout.write(`  ${c.channel.padEnd(10)} `);
    const items = await ingestChannel(c);
    all.push(...items);
    for (const item of items) seenUrls.add(item.sourceUrl || item.embedUrl);
    console.log(`${items.length} items`);
  }

  if (WEBZ_KEY) {
    console.log("\nIngesting Editorial/Print articles from Webz.io...\n");
    for (const c of WEBZ_CHANNELS) {
      process.stdout.write(`  ${c.channel.padEnd(10)} `);
      const items = await ingestWebzChannel(c, seenUrls);
      all.push(...items);
      console.log(`${items.length} articles`);
    }
  } else {
    console.warn("\nSkipping Webz.io article lane: missing WEBZ_API_KEY.");
  }

  const byChannel = {};
  for (const i of all) byChannel[i.channel] = (byChannel[i.channel] || 0) + 1;

  mkdirSync(join(ROOT, "data"), { recursive: true });
  const out = {
    generatedAt: new Date().toISOString(),
    source: WEBZ_KEY ? "YouTube Data API v3 + Webz.io newsApiLite" : "YouTube Data API v3",
    note: "Metadata/excerpts only. Playback uses YouTube's embedded player; articles link to the publisher source.",
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
