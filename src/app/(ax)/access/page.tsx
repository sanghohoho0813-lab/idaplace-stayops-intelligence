import type { Metadata } from "next";
import { AccessView } from "@/views/AccessView";

export const metadata: Metadata = { title: "출입권한" };

export default function Page() {
  return <AccessView />;
}
