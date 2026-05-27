"use client";

import React from "react";
import Sidebar from "./Sidebar";
import AuthGuard from "../auth/AuthGuard";
import CopilotChat from "../chat/CopilotChat";
import ProductTour from "../onboarding/ProductTour";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <ProductTour />
      <div className="flex flex-col md:flex-row min-h-screen w-full bg-background/50">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden flex flex-col w-full">
          {children}
        </main>
      </div>
      <CopilotChat />
    </AuthGuard>
  );
}
