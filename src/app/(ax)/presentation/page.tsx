import type { Metadata } from "next";
import { PresentationView } from "@/views/PresentationView";

export const metadata: Metadata = { title: "시연 모드" };

export default function Page() {
  return <PresentationView />;
}
