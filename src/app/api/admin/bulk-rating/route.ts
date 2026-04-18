import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { isAdminUid } from "@/lib/adminUids";
import { clampRating, DEFAULT_INITIAL_RATING } from "@/lib/elo";
import { getAdminFirestore } from "@/lib/firebaseAdmin";
import { getUidFromIdToken } from "@/lib/identityToolkit";

type Body = {
  idToken?: string;
  mode?: "set1000" | "delta";
  delta?: number;
};

function readSeasonFromDoc(d: Record<string, unknown>): number {
  const cr = d.current_rate;
  if (typeof cr === "number" && Number.isFinite(cr)) return clampRating(cr);
  const legacy = d.rating;
  if (typeof legacy === "number" && Number.isFinite(legacy)) {
    return clampRating(legacy);
  }
  return DEFAULT_INITIAL_RATING;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const idToken = body.idToken;
  const mode = body.mode;

  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json(
      { ok: false, error: "idToken が必要です" },
      { status: 400 }
    );
  }
  if (mode !== "set1000" && mode !== "delta") {
    return NextResponse.json(
      { ok: false, error: "mode は set1000 または delta です" },
      { status: 400 }
    );
  }

  const uid = await getUidFromIdToken(idToken);
  if (!uid || !isAdminUid(uid)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const delta =
    mode === "delta"
      ? typeof body.delta === "number" && Number.isFinite(body.delta)
        ? body.delta
        : -500
      : 0;

  try {
    const db = getAdminFirestore();
    const snap = await db.collection("users").get();
    let batch = db.batch();
    let batchCount = 0;
    let updated = 0;

    for (const docSnap of snap.docs) {
      const d = docSnap.data() as Record<string, unknown>;

      if (mode === "set1000") {
        batch.set(
          docSnap.ref,
          {
            current_rate: 1000,
            rating: 1000,
            lifetime_total_rate: 1000,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        const cr = readSeasonFromDoc(d);
        const newCr = clampRating(cr + delta);
        batch.set(
          docSnap.ref,
          {
            current_rate: newCr,
            rating: newCr,
            lifetime_total_rate: newCr,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      batchCount++;
      updated++;
      if (batchCount >= 500) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({ ok: true, updated });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (
      message.includes("FIREBASE_SERVICE_ACCOUNT_JSON") ||
      message.includes("credential")
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "サーバーにサービスアカウントが未設定です。Vercel に FIREBASE_SERVICE_ACCOUNT_JSON を設定してください。",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
