"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export default function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="no-select no-overscroll flex h-screen overflow-hidden">
      {/* Collapsed sidebar */}
      <Sidebar collapsed />

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
