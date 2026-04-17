import {
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { NextResponse } from "next/server";
import { getUidFromIdToken } from "@/lib/identityToolkit";
import { withUserFirestore } from "@/lib/firebaseUserFirestore";

const PRICE = 3000;

export async function POST(req: Request) {
  const body = (await req.json()) as { idToken?: string };
  const idToken = body.idToken;
  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json(
      { ok: false, error: "idToken が必要です" },
      { status: 400 }
    );
  }

  const uid = await getUidFromIdToken(idToken);
  if (!uid) {
    return NextResponse.json(
      { ok: false, error: "トークンが無効です" },
      { status: 401 }
    );
  }

  try {
    const result = await withUserFirestore(idToken, async (db) => {
      const userRef = doc(db, "users", uid);
      return runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef);
        const goldBefore =
          snap.exists() &&
          typeof snap.data()?.gold === "number" &&
          Number.isFinite(snap.data()?.gold as number)
            ? (snap.data()?.gold as number)
            : 0;
        const hasBuff =
          snap.exists() &&
          (snap.data() as { next_win_rating_double?: unknown })
            .next_win_rating_double === true;
        if (hasBuff) {
          return {
            ok: false as const,
            error: "すでに購入済みです（次の勝利まで有効）",
          };
        }
        if (goldBefore < PRICE) {
          return {
            ok: false as const,
            error: `ゴールドが足りません（必要 ${PRICE}）`,
          };
        }
        tx.set(
          userRef,
          {
            gold: goldBefore - PRICE,
            next_win_rating_double: true,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        return {
          ok: true as const,
          gold: goldBefore - PRICE,
        };
      });
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true, gold: result.gold });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
