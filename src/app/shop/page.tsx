import type { Metadata } from "next";
import { ShopClient } from "./ShopClient";

export const metadata: Metadata = {
  title: "ショップ",
  description:
    "原神ゲッサーのゴールドショップ。勝利時レートブーストなどを購入できます。",
  alternates: {
    canonical: "/shop",
  },
};

export default function ShopPage() {
  return <ShopClient />;
}
