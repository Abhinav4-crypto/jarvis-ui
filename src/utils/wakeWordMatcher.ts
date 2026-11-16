export type WakeSensitivity = 'low' | 'medium' | 'high';

export interface WakeMatchResult {
  matched: boolean;
  score: number;
  remainderCommand: string;
  matchedPhrase: string;
}

const SENSITIVITY_THRESHOLDS: Record<WakeSensitivity, number> = {
  low: 0.9,
  medium: 0.76,
  high: 0.64,
};

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const dist = levenshtein(a, b);
  return Math.max(0, 1 - dist / Math.max(a.length, b.length));
}

/**
 * Matches a custom wake word or multi-word phrase against live speech transcripts
 * using exact boundary checks plus sensitivity-calibrated phonetic similarity.
 */
export function matchCustomWakeWord(
  transcript: string,
  wakePhrase: string,
  sensitivity: WakeSensitivity = 'medium'
): WakeMatchResult {
  const normTranscript = normalizeText(transcript);
  const normWake = normalizeText(wakePhrase || 'Jarvis');

  if (!normTranscript || !normWake) {
    return { matched: false, score: 0, remainderCommand: '', matchedPhrase: wakePhrase };
  }

  // Exact match check first
  const exactIdx = normTranscript.indexOf(normWake);
  if (exactIdx !== -1) {
    const after = normTranscript.slice(exactIdx + normWake.length).trim();
    return {
      matched: true,
      score: 1,
      remainderCommand: after,
      matchedPhrase: wakePhrase,
    };
  }

  // Sliding n-gram window comparison for phonetic speech-recognition variance
  const words = normTranscript.split(' ');
  const wakeWords = normWake.split(' ');
  const windowSize = wakeWords.length;
  const threshold = SENSITIVITY_THRESHOLDS[sensitivity];

  let bestScore = 0;
  let bestEndIndex = -1;

  for (let i = 0; i <= Math.max(0, words.length - windowSize); i += 1) {
    const slice = words.slice(i, i + windowSize).join(' ');
    const score = similarity(slice, normWake);
    if (score > bestScore) {
      bestScore = score;
      bestEndIndex = i + windowSize;
    }
  }

  if (bestScore >= threshold && bestEndIndex !== -1) {
    const remainderCommand = words.slice(bestEndIndex).join(' ').trim();
    return {
      matched: true,
      score: Number(bestScore.toFixed(2)),
      remainderCommand,
      matchedPhrase: wakePhrase,
    };
  }

  return {
    matched: false,
    score: Number(bestScore.toFixed(2)),
    remainderCommand: '',
    matchedPhrase: wakePhrase,
  };
}
