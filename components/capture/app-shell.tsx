"use client";

import { CaptureServiceProvider } from "@/components/capture/capture-service-provider";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return <CaptureServiceProvider>{children}</CaptureServiceProvider>;
}
