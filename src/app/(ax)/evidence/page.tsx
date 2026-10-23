import type { Metadata } from "next";
import { EvidenceView } from "@/views/EvidenceView";

export const metadata: Metadata = { title: "실증·Evidence" };

export default function Page() {
  return <EvidenceView />;
}
