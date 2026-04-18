/**
 * 全 users のシーズンレートを 1000 にする（ローカル用ワンショット）
 * 前提: .env.local に FIREBASE_SERVICE_ACCOUNT_JSON
 * 実行: node scripts/set-all-users-rating-1000.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
const txt = readFileSync(envPath, "utf8");
const line = txt.split(/\r?\n/).find((l) =>
  l.startsWith("FIREBASE_SERVICE_ACCOUNT_JSON=")
);
if (!line) {
  console.error("FIREBASE_SERVICE_ACCOUNT_JSON が .env.local にありません。");
  process.exit(1);
}
let raw = line.slice("FIREBASE_SERVICE_ACCOUNT_JSON=".length).trim();
let cred;
if (raw.startsWith('"')) {
  cred = JSON.parse(JSON.parse(raw));
} else {
  cred = JSON.parse(raw);
}

if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(cred) });
}

const db = admin.firestore();
const snap = await db.collection("users").get();
let batch = db.batch();
let inBatch = 0;
let updated = 0;

for (const docSnap of snap.docs) {
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
  inBatch++;
  updated++;
  if (inBatch >= 500) {
    await batch.commit();
    batch = db.batch();
    inBatch = 0;
  }
}
if (inBatch > 0) {
  await batch.commit();
}

console.log(`OK: ${updated} 件のユーザーを 1000 に更新しました。`);
process.exit(0);
