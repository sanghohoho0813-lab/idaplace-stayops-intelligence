import type { Metadata } from "next";
import { Suspense } from "react";
import { StoreGate, PageSkeleton } from "@/components/providers/StoreProvider";
import { GuestShell } from "@/components/shell/GuestShell";

export const metadata: Metadata = { title: "셀프 체크인" };

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreGate>
      <GuestShell>
        <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
      </GuestShell>
    </StoreGate>
  );
}
