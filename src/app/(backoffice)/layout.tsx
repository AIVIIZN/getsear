"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export default function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Expanded sidebar */}
      <Sidebar collapsed={false} />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar showBreadcrumbs />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1280px] p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
