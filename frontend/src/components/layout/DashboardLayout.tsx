"use client";

import React from "react";
import Sidebar from "./Sidebar";
import AuthGuard from "../auth/AuthGuard";
import CopilotChat from "../chat/CopilotChat";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen w-full bg-background/50">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden flex flex-col w-full">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
      <CopilotChat />
    </AuthGuard>
  );
}
