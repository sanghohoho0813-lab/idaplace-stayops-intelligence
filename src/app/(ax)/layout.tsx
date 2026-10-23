import { Suspense } from "react";
import { StoreGate, PageSkeleton } from "@/components/providers/StoreProvider";
import { AppShell } from "@/components/shell/AppShell";

export default function AxLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreGate>
      <AppShell>
        <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
      </AppShell>
    </StoreGate>
  );
}
