import type { Metadata } from "next";
import { InsightsView } from "@/views/InsightsView";

export const metadata: Metadata = { title: "AI 운영 코치" };

export default function Page() {
  return <InsightsView />;
}
