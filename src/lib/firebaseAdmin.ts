import * as admin from "firebase-admin";

/**
 * サーバー専用。Vercel では環境変数 FIREBASE_SERVICE_ACCOUNT_JSON に
 * サービスアカウント JSON 文字列を設定（全ユーザー一括レートなど）。
 */
export function getFirebaseAdminApp(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.app();
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw || typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON が未設定です（Firebase Console → サービスアカウント → 新しい鍵の JSON）"
    );
  }
  const parsed = JSON.parse(raw) as admin.ServiceAccount;
  return admin.initializeApp({
    credential: admin.credential.cert(parsed),
  });
}

export function getAdminFirestore(): admin.firestore.Firestore {
  return getFirebaseAdminApp().firestore();
}
