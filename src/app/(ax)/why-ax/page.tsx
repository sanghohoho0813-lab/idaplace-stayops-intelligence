import type { Metadata } from "next";
import { WhyAxView } from "@/views/WhyAxView";

export const metadata: Metadata = { title: "기획의도 (Why AX)" };

export default function Page() {
  return <WhyAxView />;
}
