// ============================================================================
// Determinantal Point Process (DPP) re-ranking
// ----------------------------------------------------------------------------
// A pure greedy sort by relevance is a filter-bubble generator: it serves the
// single highest-weighted (category, format) pair until the user's options
// collapse to one theme. In identity terms that is *algorithmic foreclosure* —
// the feed forecloses the exploration phase that identity formation needs.
//
// A DPP fixes this with linear algebra instead of a "shuffle in something
// random" hack. We build an L-ensemble kernel
//
//     L = diag(q) · S · diag(q)
//
// (the quality-diversity decomposition of Kulesza & Taskar, 2012) where q is
// per-item relevance and S is a cosine-similarity kernel over feature vectors.
// The probability of drawing a set Y is proportional to det(L_Y).
//
// The property we are buying: as two feature vectors become linearly
// dependent, det(L_Y) -> 0. Redundancy is penalised *mathematically*, not
// heuristically. Picking a near-duplicate does not score "a bit lower" — it
// drives the objective to zero.
//
// Exact MAP inference over a DPP is NP-hard, so we use the fast greedy
// approximation with incremental Cholesky updates (Chen et al., NeurIPS 2018),
// which is O(k^2 n) — trivial at our corpus size and cheap enough to re-rank
// on every swipe.
//
// This module is deliberately dependency-free pure math: it knows nothing
// about recommendations, Ryff axes, or the engine. Callers build the features.
// ============================================================================

export interface DppItem {
  id: string;
  /** Feature vector. Need not be unit-norm; it is normalized internally. */
  features: number[];
  /** Relevance in [0, 1]. Mapped to kernel quality via exp(theta * quality). */
  quality: number;
}

export interface DppOptions {
  /**
   * Relevance/diversity trade-off. Higher theta weights relevance more
   * heavily; theta = 0 selects for pure diversity and ignores relevance.
   */
  theta?: number;
  /**
   * Marginal-gain floor. Once the best remaining item adds less than this to
   * the log-determinant it is effectively linearly dependent on what has
   * already been picked, and we stop rather than serve a near-duplicate.
   */
  epsilon?: number;
}

const DEFAULT_THETA = 2.2;
const DEFAULT_EPSILON = 1e-8;
const TINY = 1e-12;

function dot(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

export function normalizeVector(v: number[]): number[] {
  const norm = Math.sqrt(dot(v, v));
  if (norm < TINY) return v.map(() => 0);
  return v.map((x) => x / norm);
}

/** Cosine similarity. Our features are non-negative, so this lands in [0, 1]. */
export function cosineSimilarity(a: number[], b: number[]): number {
  return dot(normalizeVector(a), normalizeVector(b));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Greedy MAP inference for a DPP. Returns up to `k` item ids, ordered by
 * selection (first pick is the strongest relevance/diversity compromise).
 *
 * Returns fewer than `k` ids when the remaining candidates are linearly
 * dependent on the selection — that early stop IS the redundancy penalty.
 */
export function greedyMapDpp(
  items: DppItem[],
  k: number,
  opts: DppOptions = {}
): string[] {
  const theta = opts.theta ?? DEFAULT_THETA;
  const epsilon = opts.epsilon ?? DEFAULT_EPSILON;
  const n = items.length;
  if (n === 0 || k <= 0) return [];
  const want = Math.min(k, n);

  const feats = items.map((it) => normalizeVector(it.features));
  const q = items.map((it) => Math.exp(theta * clamp01(it.quality)));

  // Features are unit-norm, so S_ii = 1 and the initial squared residual
  // d2[i] = L_ii = q_i^2.
  const d2 = q.map((x) => x * x);
  // cis[i] holds the Cholesky row accumulated for item i so far.
  const cis: number[][] = items.map(() => []);
  const chosen = new Array<boolean>(n).fill(false);
  const picked: string[] = [];

  for (let step = 0; step < want; step++) {
    let best = -1;
    let bestVal = -Infinity;
    for (let i = 0; i < n; i++) {
      if (chosen[i]) continue;
      if (d2[i] > bestVal) {
        bestVal = d2[i];
        best = i;
      }
    }
    // Nothing left, or every remaining candidate is redundant.
    if (best < 0 || bestVal <= epsilon) break;

    const dj = Math.sqrt(bestVal);
    chosen[best] = true;
    picked.push(items[best].id);

    // Incremental Cholesky: project every survivor off the chosen direction.
    for (let i = 0; i < n; i++) {
      if (chosen[i]) continue;
      const lji = q[best] * dot(feats[best], feats[i]) * q[i];
      const e = (lji - dot(cis[best], cis[i])) / dj;
      cis[i].push(e);
      d2[i] = Math.max(0, d2[i] - e * e);
    }
  }

  return picked;
}

/**
 * log det(L_Y) for a chosen set — a single scalar "how varied is this batch".
 * Useful as an honest diversity metric to show alongside the deck.
 */
export function diversityLogDet(items: DppItem[], opts: DppOptions = {}): number {
  const theta = opts.theta ?? DEFAULT_THETA;
  const m = items.length;
  if (m === 0) return 0;
  const feats = items.map((it) => normalizeVector(it.features));
  const q = items.map((it) => Math.exp(theta * clamp01(it.quality)));

  // Cholesky of L; log det = 2 * sum(log(diagonal)).
  const chol: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));
  let logDet = 0;
  for (let i = 0; i < m; i++) {
    for (let j = 0; j <= i; j++) {
      const lij = q[i] * dot(feats[i], feats[j]) * q[j];
      let sum = lij;
      for (let p = 0; p < j; p++) sum -= chol[i][p] * chol[j][p];
      if (i === j) {
        if (sum <= TINY) return logDet; // singular: perfectly redundant set
        chol[i][j] = Math.sqrt(sum);
        logDet += 2 * Math.log(chol[i][j]);
      } else {
        chol[i][j] = sum / chol[j][j];
      }
    }
  }
  return logDet;
}

/**
 * How much a candidate overlaps the strongest thing already selected, in
 * [0, 1]. Drives user-facing copy ("this covers ground you already have").
 */
export function redundancyAgainst(
  candidate: DppItem,
  selected: DppItem[]
): number {
  let worst = 0;
  for (const s of selected) {
    const sim = cosineSimilarity(candidate.features, s.features);
    if (sim > worst) worst = sim;
  }
  return clamp01(worst);
}
