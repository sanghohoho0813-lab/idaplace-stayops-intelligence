import type { Metadata } from "next";
import { Suspense } from "react";
import { StoreGate, PageSkeleton } from "@/components/providers/StoreProvider";
import { StaffShell } from "@/components/shell/StaffShell";

export const metadata: Metadata = { title: "현장직원 앱" };

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreGate>
      <StaffShell>
        <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
      </StaffShell>
    </StoreGate>
  );
}
