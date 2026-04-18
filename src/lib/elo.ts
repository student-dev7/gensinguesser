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

/** プレイヤーレートの下限（週次調整後もこれ未満にならない） */
export const MIN_RATING = 1000;
/** シーズン current_rate・rating の上限（Iミシックは事実上無制限に近い） */
export const MAX_RATING = 9_999_999;
/** Firestore lifetime_total_rate（シーズン値と同期）の上限 */
export const MAX_LIFETIME_TOTAL_RATE = MAX_RATING;

export function clampRating(rating: number) {
  return Math.max(MIN_RATING, Math.min(MAX_RATING, rating));
}

export function clampLifetimeTotalRate(rating: number) {
  return Math.max(MIN_RATING, Math.min(MAX_LIFETIME_TOTAL_RATE, rating));
}

/** 新規ユーザー・初回の基準（全ユーザー一律 1000 スタート） */
export const DEFAULT_INITIAL_RATING = 1000;

/** 週が変わったときシーズンレートから減らす量（`clampRating(Rp - この値)`） */
export const WEEKLY_RATING_DROP = 1000;
const DEFAULT_OPPONENT_RATING = 1000;

/**
 * シーズンレート帯ごとの勝利基礎点・敗北時の減少pt。
 * 序盤: ウォリアー〜マスター（〜2439）
 * 中盤: グランドマスター〜レジェンド（2440〜4599）
 * 終盤: ミシック以上（4600〜）
 */
export function getSeasonWinBaseAndLoss(seasonRating: number): {
  winBase: number;
  lossPenalty: number;
} {
  const r = clampRating(seasonRating);
  if (r < 2440) return { winBase: 20, lossPenalty: 10 };
  if (r < 4600) return { winBase: 15, lossPenalty: 12 };
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

const HAND_AVG_BONUS = 3;

/**
 * 勝利時: 増分 = 段階別基礎点 +（そのキャラの平均手数より少ない場合 +3）
 * characterAverageHands は当該プレイ反映前のキャラ別平均（pureMeanHandCount）
 */
export function applyWinRatingBonus(
  seasonRating: number,
  myHandCount: number,
  characterAverageHands: number
) {
  const { winBase } = getSeasonWinBaseAndLoss(seasonRating);
  const handAvgBonus =
    Number.isFinite(characterAverageHands) &&
    myHandCount < characterAverageHands
      ? HAND_AVG_BONUS
      : 0;
  const ratingDelta = winBase + handAvgBonus;
  const newRating = clampRating(seasonRating + ratingDelta);
  return {
    newRating,
    ratingDelta,
    baseBonus: winBase,
    handAvgBonus,
  };
}
