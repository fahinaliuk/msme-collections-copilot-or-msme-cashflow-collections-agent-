"use client";

import React, { useState, useEffect } from "react";
import { Step, STATUS } from "react-joyride";
import dynamic from "next/dynamic";

const Joyride = dynamic(() => import("react-joyride").then((mod) => mod.Joyride as any), { ssr: false }) as any;

export default function ProductTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    // Check if the user has already seen the tour
    const hasSeenTour = localStorage.getItem("hasSeenTour");
    
    // Only run on the client side after a short delay to ensure DOM elements are painted
    if (!hasSeenTour) {
      const timer = setTimeout(() => {
        setRun(true);
        // Instantly save to local storage so it NEVER runs again on other pages or refreshes
        localStorage.setItem("hasSeenTour", "true");
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleJoyrideCallback = (data: any) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem("hasSeenTour", "true");
    }
  };

  const steps: Step[] = [
    {
      target: "body",
      content: (
        <div className="text-left space-y-2">
          <h3 className="text-lg font-bold text-emerald-600">Welcome to MSME Collections Copilot! 🚀</h3>
          <p className="text-sm text-slate-600">
            Let's take a quick 30-second tour to show you how to turn your messy ledgers into cash.
          </p>
        </div>
      ),
      placement: "center",
      
    },
    {
      target: ".tour-dashboard-step",
      content: (
        <div className="text-left space-y-2">
          <h3 className="text-base font-bold text-emerald-600">Your Cashflow Health</h3>
          <p className="text-sm text-slate-600">
            Monitor your total receivables, overdue percentages, and aging buckets at a glance.
          </p>
        </div>
      ),
      placement: "bottom",
    },
    {
      target: ".tour-ingest-step",
      content: (
        <div className="text-left space-y-2">
          <h3 className="text-base font-bold text-emerald-600">1. Upload your Data</h3>
          <p className="text-sm text-slate-600">
            Upload your messy Excel files or text logs here. Our AI will instantly structure it and flag bad data in the Review Queue.
          </p>
        </div>
      ),
      placement: "right",
    },
    {
      target: ".tour-priority-step",
      content: (
        <div className="text-left space-y-2">
          <h3 className="text-base font-bold text-emerald-600">2. Who to Call First?</h3>
          <p className="text-sm text-slate-600">
            Stop guessing. The Copilot analyzes payment history and days overdue to tell you exactly who you need to call today.
          </p>
        </div>
      ),
      placement: "right",
    },
    {
      target: ".tour-chat-step",
      content: (
        <div className="text-left space-y-2">
          <h3 className="text-base font-bold text-emerald-600">3. Chat with your Data</h3>
          <p className="text-sm text-slate-600">
            Need an aggressive email drafted? Need to know who your biggest risk is? Just ask the AI Chatbot anytime!
          </p>
        </div>
      ),
      placement: "top-start",
    },
  ];

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: "#10b981", // Tailwind emerald-500
          zIndex: 10000,
        },
        tooltipContainer: {
          textAlign: "left",
        },
        buttonNext: {
          backgroundColor: "#10b981",
          borderRadius: "8px",
          padding: "8px 16px",
          fontSize: "14px",
          fontWeight: "bold",
        },
        buttonBack: {
          marginRight: 10,
          color: "#64748b",
        },
        buttonSkip: {
          color: "#94a3b8",
        },
      }}
    />
  );
}
