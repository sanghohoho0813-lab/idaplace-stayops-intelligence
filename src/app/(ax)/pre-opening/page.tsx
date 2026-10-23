import type { Metadata } from "next";
import { PreOpeningView } from "@/views/PreOpeningView";

export const metadata: Metadata = { title: "개업 준비" };

export default function Page() {
  return <PreOpeningView />;
}
