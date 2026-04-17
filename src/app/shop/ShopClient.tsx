"use client";

import Link from "next/link";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { GoldCoinIcon } from "@/components/GoldCoinIcon";
import {
  ensureAnonymousSession,
  getFirebaseAuth,
} from "@/lib/firebaseClient";
import { logAnalyticsEvent } from "@/lib/firebaseAnalytics";

const PRICE_NEXT_WIN_DOUBLE = 3000;

export function ShopClient() {
  const [gold, setGold] = useState<number | null>(null);
  const [hasBuff, setHasBuff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureAnonymousSession();
      const auth = getFirebaseAuth();
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setGold(0);
        setHasBuff(false);
        return;
      }
      const db = getFirestore(auth.app);
      const snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) {
        setGold(0);
        setHasBuff(false);
        return;
      }
      const d = snap.data();
      const g =
        typeof d?.gold === "number" && Number.isFinite(d.gold) ? d.gold : 0;
      setGold(g);
      setHasBuff(d?.next_win_rating_double === true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void logAnalyticsEvent("view_shop", { page: "/shop" });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const purchaseDouble = useCallback(async () => {
    setMessage(null);
    setError(null);
    setBuying(true);
    try {
      await ensureAnonymousSession();
      const auth = getFirebaseAuth();
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        setError("ログインが必要です");
        return;
      }
      const res = await fetch("/api/shop/purchase-next-win-double", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        gold?: number;
      };
      if (!json?.ok) {
        setError(json?.error ?? "購入に失敗しました");
        return;
      }
      setMessage("購入しました。次に勝利したときのレート増分が 2 倍になります。");
      if (typeof json.gold === "number") setGold(json.gold);
      setHasBuff(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBuying(false);
    }
  }, []);

  const canBuy =
    gold !== null &&
    gold >= PRICE_NEXT_WIN_DOUBLE &&
    !hasBuff &&
    !loading &&
    !buying;

  return (
    <div className="min-h-screen bg-[#0a0f1e] px-4 py-12 text-white">
      <div className="mx-auto w-full max-w-lg">
        <header className="mb-10 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.35em] text-[#ece5d8]/80">
            GenshinGuesser
          </p>
          <h1 className="mt-3 flex items-center justify-center gap-2 text-3xl font-semibold tracking-tight text-[#ece5d8] sm:text-4xl">
            <GoldCoinIcon className="h-9 w-9 text-amber-300 sm:h-10 sm:w-10" />
            ショップ
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/55">
            ゴールドでアイテムを購入できます。
          </p>
          <div className="mt-8">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-[#ece5d8]/35 bg-[#12182a] px-6 py-2.5 text-sm font-medium text-[#ece5d8] shadow-[0_0_24px_-8px_rgba(236,229,216,0.25)] transition hover:border-[#ece5d8]/55 hover:bg-[#1a2238]"
            >
              ← トップへ戻る
            </Link>
          </div>
        </header>

        <div className="mb-6 flex items-center justify-between rounded-xl border border-amber-500/30 bg-[#12182a]/95 px-4 py-3">
          <span className="text-sm text-white/60">所持ゴールド</span>
          <span className="flex items-center gap-1.5 text-lg font-semibold tabular-nums text-amber-100">
            <GoldCoinIcon className="h-6 w-6 text-amber-300" />
            {loading ? "…" : Math.round(gold ?? 0).toLocaleString("ja-JP")}
          </span>
        </div>

        <div className="rounded-2xl border border-[#ece5d8]/20 bg-[#0d1324]/95 p-6 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#ece5d8]">
                勝利ブースト
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                次に勝利したときの
                <span className="text-amber-200/95">レート増分</span>
                が通常の 2 倍になります（1 回の勝利で消費）。
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-[#ece5d8]/10 pt-4">
            <span className="text-sm text-white/50">価格</span>
            <span className="flex items-center gap-1.5 text-base font-semibold text-amber-100">
              <GoldCoinIcon className="h-5 w-5 text-amber-300" />
              {PRICE_NEXT_WIN_DOUBLE.toLocaleString("ja-JP")}
            </span>
          </div>
          {hasBuff && (
            <p className="mt-3 text-sm text-emerald-300/95">
              購入済みです。次の勝利まで有効です。
            </p>
          )}
          {error && (
            <p className="mt-3 text-sm text-rose-400">{error}</p>
          )}
          {message && (
            <p className="mt-3 text-sm text-emerald-300/95">{message}</p>
          )}
          <button
            type="button"
            disabled={!canBuy}
            onClick={() => void purchaseDouble()}
            className="mt-5 w-full rounded-xl border border-amber-500/45 bg-amber-950/40 px-4 py-3 text-sm font-medium text-amber-100 transition hover:border-amber-400/60 hover:bg-amber-950/60 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {buying
              ? "処理中…"
              : hasBuff
                ? "購入済み"
                : gold !== null && gold < PRICE_NEXT_WIN_DOUBLE
                  ? "ゴールドが足りません"
                  : "購入する"}
          </button>
        </div>
      </div>
    </div>
  );
}
