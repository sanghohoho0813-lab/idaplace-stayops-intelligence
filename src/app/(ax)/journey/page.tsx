import type { Metadata } from "next";
import { JourneyView } from "@/views/JourneyView";

export const metadata: Metadata = { title: "실시간 출입 흐름" };

export default function Page() {
  return <JourneyView />;
}
