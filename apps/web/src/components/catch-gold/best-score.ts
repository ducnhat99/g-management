const KEY = 'catch-gold:best';

// Browser storage can be missing or throw (private mode, blocked storage): the game still works,
// it just forgets the best score.

export function readBestScore(): number {
  try {
    const value = Number(window.localStorage.getItem(KEY));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

/** Saves `score` if it beats the stored best; returns the best score after saving. */
export function saveBestScore(score: number): number {
  const best = readBestScore();
  if (score <= best) return best;
  try {
    window.localStorage.setItem(KEY, String(score));
  } catch {
    // Ignore: see above.
  }
  return score;
}
