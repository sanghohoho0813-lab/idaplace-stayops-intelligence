import type { Metadata } from "next";
import { DashboardView } from "@/views/DashboardView";

export const metadata: Metadata = { title: "대시보드" };

export default function Page() {
  return <DashboardView />;
}
