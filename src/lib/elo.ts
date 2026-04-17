export function expectedScore(playerRating: number, characterRating: number) {
  return 1 / (1 + Math.pow(10, (characterRating - playerRating) / 400));
}

// Hand数が少ないほどSが大きくなる連続スコア（レガシー／他用途）
// S = Mavg / (My + Mavg)
export function handScoreFromAvg(myHandCount: number, mAvgHandCount: number) {
  if (myHandCount < 0) return 0;
  if (mAvgHandCount <= 0) return 0;
  const s = mAvgHandCount / (myHandCount + mAvgHandCount);
  return Math.max(0, Math.min(1, s));
}

/** プレイヤーレートの下限（週次リセット後の基準は DEFAULT_INITIAL_RATING） */
export const MIN_RATING = 1000;
/** シーズン／週次の current_rate・rating の上限 */
export const MAX_RATING = 5000;
/** Firestore の累計レート lifetime_total_rate の上限 */
export const MAX_LIFETIME_TOTAL_RATE = 9999;

export function clampRating(rating: number) {
  return Math.max(MIN_RATING, Math.min(MAX_RATING, rating));
}

/** 累計レート（ランク表示・昇格の基準）のみ 9999 まで許可 */
export function clampLifetimeTotalRate(rating: number) {
  return Math.max(MIN_RATING, Math.min(MAX_LIFETIME_TOTAL_RATE, rating));
}

/** 新規ユーザー・週次リセット後の基準（全ユーザー一律 1000 スタート） */
export const DEFAULT_INITIAL_RATING = 1000;
const DEFAULT_OPPONENT_RATING = 1000;

/**
 * シーズン（週次）レート帯ごとの勝利基礎点・敗北時の減少pt。
 */
export function getSeasonWinBaseAndLoss(seasonRating: number): {
  winBase: number;
  lossPenalty: number;
} {
  const r = clampRating(seasonRating);
  if (r < 1720) return { winBase: 20, lossPenalty: 10 };
  if (r < 2800) return { winBase: 15, lossPenalty: 12 };
  return { winBase: 12, lossPenalty: 12 };
}

export type ComputeRatingOptions = {
  opponentRating?: number;
  kFactor?: number;
};

/**
 * Elo 更新（個人モード等で使用する場合あり）
 */
export function computeNewPlayerRating(
  currentRating: number,
  actualScore: number,
  options?: ComputeRatingOptions
) {
  const opponentRating = options?.opponentRating ?? DEFAULT_OPPONENT_RATING;
  const k = options?.kFactor ?? 32;
  const S = Math.max(0, Math.min(1, actualScore));
  const E = expectedScore(currentRating, opponentRating);
  const newRating = clampRating(currentRating + k * (S - E));
  return {
    newRating,
    ratingDelta: newRating - currentRating,
    S,
    E,
  };
}

const WIN_SPEED_MULTIPLIER = 2;

export type ApplyWinRatingBonusOptions = {
  ghostHandCount?: number;
};

/**
 * 勝利時: 増分 = 基礎点 + max(0, 4 - 自分の手数) × 2 +（VS 時）ゴースト撃破ボーナス
 */
export function applyWinRatingBonus(
  seasonRating: number,
  myHandCount: number,
  options?: ApplyWinRatingBonusOptions
) {
  const { winBase } = getSeasonWinBaseAndLoss(seasonRating);
  const speedBonus = Math.max(0, 4 - myHandCount) * WIN_SPEED_MULTIPLIER;
  const ghostBeatBonus =
    options?.ghostHandCount !== undefined
      ? Math.max(0, options.ghostHandCount - myHandCount) * WIN_SPEED_MULTIPLIER
      : 0;
  const ratingDelta = winBase + speedBonus + ghostBeatBonus;
  const newRating = clampRating(seasonRating + ratingDelta);
  return {
    newRating,
    ratingDelta,
    baseBonus: winBase,
    speedBonus,
    ghostBeatBonus,
  };
}
