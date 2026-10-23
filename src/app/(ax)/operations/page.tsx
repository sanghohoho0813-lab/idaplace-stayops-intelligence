import type { Metadata } from "next";
import { OperationsView } from "@/views/OperationsView";

export const metadata: Metadata = { title: "청소·현장 운영" };

export default function Page() {
  return <OperationsView />;
}
