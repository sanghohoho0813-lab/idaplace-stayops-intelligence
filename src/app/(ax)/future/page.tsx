import type { Metadata } from "next";
import { FutureView } from "@/views/FutureView";

export const metadata: Metadata = { title: "확장 미리보기" };

export default function Page() {
  return <FutureView />;
}
