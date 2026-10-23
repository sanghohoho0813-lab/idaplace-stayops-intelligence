"use client";
import { FrameProvider, DeviceViewProvider } from "@/components/device/DeviceView";
import { DeviceViewShell } from "@/components/device/DeviceViewShell";
import { StoreProvider } from "./StoreProvider";
import { ToastProvider } from "@/components/ui/Toast";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <FrameProvider>
      <StoreProvider>
        <DeviceViewProvider>
          <ToastProvider>
            <DeviceViewShell>{children}</DeviceViewShell>
          </ToastProvider>
        </DeviceViewProvider>
      </StoreProvider>
    </FrameProvider>
  );
}
