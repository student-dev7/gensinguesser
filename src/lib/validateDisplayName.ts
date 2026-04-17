import { BAD_WORD_SUBSTRINGS } from "@/lib/constants/badWords";

export type DisplayNameValidation =
  | { ok: true; name: string }
  | { ok: false, error: string };

const MIN = 2;
const MAX = 12;
const MAX_ADMIN = 80;

export type ValidateDisplayNameOptions = {
  /** 管理者 UID のみ。禁止語部分一致をスキップ（サーバーでも uid と突き合わせること） */
  ignoreBadSubstrings?: boolean;
  /** 管理者のみ。文字数・禁止語を免除（1〜80 文字） */
  adminFullBypass?: boolean;
};

/** 表示名チェック（2〜12 文字・禁止語）。重複は許可。 */
export function validateDisplayName(
  raw: string,
  options?: ValidateDisplayNameOptions
): DisplayNameValidation {
  const name = raw.trim();

  if (options?.adminFullBypass) {
    if (name.length < 1) {
      return { ok: false, error: "名前を入力してください" };
    }
    if (name.length > MAX_ADMIN) {
      return { ok: false, error: `名前は${MAX_ADMIN}文字以内で入力してください` };
    }
    return { ok: true, name };
  }

  if (name.length < MIN) {
    return { ok: false, error: `名前は${MIN}文字以上で入力してください` };
  }
  if (name.length > MAX) {
    return { ok: false, error: `名前は${MAX}文字以内で入力してください` };
  }

  if (!options?.ignoreBadSubstrings) {
    const lower = name.toLowerCase();
    for (const bad of BAD_WORD_SUBSTRINGS) {
      if (lower.includes(bad.toLowerCase())) {
        return { ok: false, error: "使用できない文字列が含まれています" };
      }
    }
  }

  return { ok: true, name };
}
