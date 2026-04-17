import { DEFAULT_INITIAL_RATING, MIN_RATING } from "./elo";

/**
 * 【ランク表示の基準：累計レート（lifetime_total_rate）】
 */

export function rateForRankDisplay(
  lifetimeTotalRate: number | null | undefined
): number {
  if (lifetimeTotalRate == null || !Number.isFinite(lifetimeTotalRate)) {
    return DEFAULT_INITIAL_RATING;
  }
  return lifetimeTotalRate;
}

export type RomanTier = "IV" | "III" | "II" | "I";

export type RankId =
  | "warrior"
  | "elite"
  | "master"
  | "grandmaster"
  | "epic"
  | "legend"
  | "mythic"
  | "mythic-glory"
  | "mythic-immortal";

export type RankData = {
  rankId: RankId;
  rankName: string;
  imagePath: string;
  tierRoman: RomanTier | null;
  bracketMin: number;
  bracketMax: number;
};

export type TierProgress = {
  progressPercent: number;
  pointsToNext: number;
  isFinal: boolean;
};

const ROMAN_BY_INDEX: RomanTier[] = ["IV", "III", "II", "I"];

export const GLORY_MYTHIC_MIN = 3240;
export const IMMORTAL_MYTHIC_MIN = 3720;

type RankBand = {
  id: Exclude<RankId, "mythic-immortal">;
  nameJa: string;
  min: number;
  max: number;
  tierWidth: number;
};

export const RANK_BANDS: readonly RankBand[] = [
  { id: "warrior", nameJa: "ウォリアー", min: 1000, max: 1199, tierWidth: 50 },
  { id: "elite", nameJa: "エリート", min: 1200, max: 1439, tierWidth: 60 },
  { id: "master", nameJa: "マスター", min: 1440, max: 1719, tierWidth: 70 },
  {
    id: "grandmaster",
    nameJa: "グランドマスター",
    min: 1720,
    max: 2039,
    tierWidth: 80,
  },
  { id: "epic", nameJa: "エピック", min: 2040, max: 2399, tierWidth: 90 },
  { id: "legend", nameJa: "レジェンド", min: 2400, max: 2799, tierWidth: 100 },
  { id: "mythic", nameJa: "ミシック", min: 2800, max: 3239, tierWidth: 110 },
  {
    id: "mythic-glory",
    nameJa: "Gミシック",
    min: 3240,
    max: 3719,
    tierWidth: 120,
  },
] as const;

/** @deprecated 互換: Gミシック下限 */
export const MYTHIC_GLORY_MIN = GLORY_MYTHIC_MIN;

export function rankImagePath(rankId: RankId): string {
  return `/assets/ranks/${rankId}.png`;
}

export function getRankLogoContentScale(rankId: RankId): number {
  void rankId;
  return 1;
}

export function getRankRangeTableRows(): {
  rankId: RankId;
  rankName: string;
  rangeLabel: string;
}[] {
  const rows = RANK_BANDS.map((b) => ({
    rankId: b.id as RankId,
    rankName: b.nameJa,
    rangeLabel: `${b.min} 〜 ${b.max}`,
  }));
  rows.push({
    rankId: "mythic-immortal",
    rankName: "Iミシック",
    rangeLabel: `${IMMORTAL_MYTHIC_MIN} 〜`,
  });
  return rows;
}

function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return MIN_RATING;
  return Math.max(MIN_RATING, rate);
}

function tierBoundsInBand(
  band: RankBand,
  tierRoman: RomanTier
): { low: number; high: number } {
  const idx = ROMAN_BY_INDEX.indexOf(tierRoman);
  const w = band.tierWidth;
  const low = band.min + idx * w;
  const high = Math.min(band.max, low + w - 1);
  return { low, high };
}

export function getRankData(rate: number): RankData {
  const r = clampRate(rate);

  if (r >= IMMORTAL_MYTHIC_MIN) {
    return {
      rankId: "mythic-immortal",
      rankName: "Iミシック",
      imagePath: rankImagePath("mythic-immortal"),
      tierRoman: null,
      bracketMin: IMMORTAL_MYTHIC_MIN,
      bracketMax: 99999,
    };
  }

  const band =
    RANK_BANDS.find((b) => r >= b.min && r <= b.max) ?? RANK_BANDS[0]!;
  const w = band.tierWidth;
  const idx = Math.min(3, Math.max(0, Math.floor((r - band.min) / w)));
  const tierRoman = ROMAN_BY_INDEX[idx]!;
  const { low, high } = tierBoundsInBand(band, tierRoman);

  return {
    rankId: band.id,
    rankName: band.nameJa,
    imagePath: rankImagePath(band.id),
    tierRoman,
    bracketMin: low,
    bracketMax: high,
  };
}

const LADDER_RANK_ORDER: readonly RankId[] = [
  "warrior",
  "elite",
  "master",
  "grandmaster",
  "epic",
  "legend",
  "mythic",
  "mythic-glory",
  "mythic-immortal",
] as const;

function rankLadderIndex(rankId: RankId): number {
  return LADDER_RANK_ORDER.indexOf(rankId);
}

const ROMAN_STEP: Record<RomanTier, number> = {
  IV: 0,
  III: 1,
  II: 2,
  I: 3,
};

export function formatRankTierLine(data: RankData): string {
  return data.tierRoman != null
    ? `${data.rankName} ${data.tierRoman}`
    : data.rankName;
}

export function isLifetimeTierOrRankPromoted(
  lifetimeBefore: number,
  lifetimeAfter: number
): boolean {
  if (
    !Number.isFinite(lifetimeBefore) ||
    !Number.isFinite(lifetimeAfter) ||
    lifetimeAfter <= lifetimeBefore
  ) {
    return false;
  }
  const before = getRankData(lifetimeBefore);
  const after = getRankData(lifetimeAfter);

  const ai = rankLadderIndex(after.rankId);
  const bi = rankLadderIndex(before.rankId);
  if (ai > bi) return true;
  if (ai < bi) return false;

  if (before.tierRoman != null && after.tierRoman != null) {
    return ROMAN_STEP[after.tierRoman] > ROMAN_STEP[before.tierRoman];
  }
  return false;
}

export function getTierProgress(rate: number): TierProgress {
  const r = clampRate(rate);

  if (r >= IMMORTAL_MYTHIC_MIN) {
    return { progressPercent: 100, pointsToNext: 0, isFinal: true };
  }

  const band =
    RANK_BANDS.find((b) => r >= b.min && r <= b.max) ?? RANK_BANDS[0]!;
  const w = band.tierWidth;
  const idx = Math.min(3, Math.max(0, Math.floor((r - band.min) / w)));
  const tierRoman = ROMAN_BY_INDEX[idx]!;
  const { low, high } = tierBoundsInBand(band, tierRoman);

  const denom = high - low;
  const progressPercent =
    denom <= 0 ? 0 : Math.max(0, Math.min(100, ((r - low) / denom) * 100));

  const isTierI = tierRoman === "I";
  let nextThreshold: number;
  if (!isTierI) {
    nextThreshold = high + 1;
  } else if (band.id === "mythic-glory") {
    nextThreshold = IMMORTAL_MYTHIC_MIN;
  } else if (band.id === "mythic") {
    nextThreshold = GLORY_MYTHIC_MIN;
  } else {
    const bandIdx = RANK_BANDS.indexOf(band);
    const nextBand = RANK_BANDS[bandIdx + 1];
    nextThreshold = nextBand ? nextBand.min : GLORY_MYTHIC_MIN;
  }

  const pointsToNext = Math.max(0, Math.ceil(nextThreshold - r));

  return {
    progressPercent,
    pointsToNext,
    isFinal: false,
  };
}

export type TierBarFromRate = {
  tierSpan: number;
  progressInTier: number;
  fillRatio: number;
  pointsToNext: number;
  isFinal: boolean;
};

export function getTierBarFromLifetimeRate(lifetimeRate: number): TierBarFromRate {
  const r = clampRate(lifetimeRate);

  if (r >= IMMORTAL_MYTHIC_MIN) {
    return {
      tierSpan: 0,
      progressInTier: 0,
      fillRatio: 1,
      pointsToNext: 0,
      isFinal: true,
    };
  }

  const band =
    RANK_BANDS.find((b) => r >= b.min && r <= b.max) ?? RANK_BANDS[0]!;
  const w = band.tierWidth;
  const idx = Math.min(3, Math.max(0, Math.floor((r - band.min) / w)));
  const tierRoman = ROMAN_BY_INDEX[idx]!;
  const { low, high } = tierBoundsInBand(band, tierRoman);

  const rInt = Math.floor(r);
  const offsetFromLow =
    rInt < low ? 0 : Math.min(w - 1, Math.max(0, rInt - low));
  const progressInTier = w <= 1 ? 0 : offsetFromLow;
  const fillRatio =
    w <= 1
      ? rInt >= low && rInt <= high
        ? 1
        : 0
      : Math.min(1, Math.max(0, (rInt - low) / (w - 1)));

  const tp = getTierProgress(lifetimeRate);

  return {
    tierSpan: w,
    progressInTier,
    fillRatio,
    pointsToNext: tp.pointsToNext,
    isFinal: tp.isFinal,
  };
}

const ACCENT_HEX: Record<RankId, string> = {
  warrior: "#94a3b8",
  elite: "#4ade80",
  master: "#38bdf8",
  grandmaster: "#a78bfa",
  epic: "#f472b6",
  legend: "#fbbf24",
  mythic: "#f87171",
  "mythic-glory": "#fde047",
  "mythic-immortal": "#f8fafc",
};

export function getRankAccentHex(rankId: RankId): string {
  return ACCENT_HEX[rankId] ?? "#94a3b8";
}
