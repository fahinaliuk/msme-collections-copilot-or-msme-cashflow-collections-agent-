"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsAPI } from "@/lib/api";
import { Zap, Shield } from "lucide-react";

/**
 * AutopilotToggle — Premium animated toggle switch that controls
 * Copilot Mode ↔ Autopilot Mode on the Executive Dashboard.
 *
 * Uses TanStack React Query to sync the `is_autopilot_enabled` state
 * with the backend via PATCH /api/users/settings.
 */
export default function AutopilotToggle() {
  const queryClient = useQueryClient();

  // Fetch current autopilot state
  const { data: settings, isLoading } = useQuery({
    queryKey: ["user-settings"],
    queryFn: settingsAPI.getSettings,
    staleTime: 30_000,
  });

  // Mutation to toggle autopilot
  const mutation = useMutation({
    mutationFn: (enabled: boolean) =>
      settingsAPI.updateSettings({ is_autopilot_enabled: enabled }),
    onMutate: async (enabled) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["user-settings"] });
      const previous = queryClient.getQueryData(["user-settings"]);
      queryClient.setQueryData(["user-settings"], (old: any) => ({
        ...old,
        is_autopilot_enabled: enabled,
      }));
      return { previous };
    },
    onError: (_err, _enabled, context) => {
      // Rollback on error
      queryClient.setQueryData(["user-settings"], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["user-settings"] });
    },
  });

  const isAutopilot = settings?.is_autopilot_enabled ?? false;

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-8 w-[52px] rounded-full bg-muted animate-pulse" />
        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* Toggle track */}
      <button
        id="autopilot-toggle"
        role="switch"
        aria-checked={isAutopilot}
        aria-label={isAutopilot ? "Switch to Copilot Mode" : "Switch to Autopilot Mode"}
        onClick={() => mutation.mutate(!isAutopilot)}
        disabled={mutation.isPending}
        className={`
          relative h-8 w-[52px] rounded-full p-0.5
          transition-colors duration-300 ease-in-out
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
          focus-visible:ring-offset-background
          disabled:opacity-60 disabled:cursor-not-allowed
          ${isAutopilot
            ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 focus-visible:ring-violet-500 shadow-lg shadow-violet-500/25"
            : "bg-zinc-700 focus-visible:ring-emerald-500"
          }
        `}
      >
        {/* Glow effect when autopilot is on */}
        <AnimatePresence>
          {isAutopilot && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 blur-md"
            />
          )}
        </AnimatePresence>

        {/* Sliding thumb */}
        <motion.div
          layout
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 30,
          }}
          className={`
            relative z-10 h-7 w-7 rounded-full shadow-md
            flex items-center justify-center
            ${isAutopilot
              ? "bg-white ml-auto"
              : "bg-zinc-300 ml-0"
            }
          `}
        >
          <AnimatePresence mode="wait">
            {isAutopilot ? (
              <motion.div
                key="zap"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{ duration: 0.2 }}
              >
                <Zap size={14} className="text-violet-600 fill-violet-600" />
              </motion.div>
            ) : (
              <motion.div
                key="shield"
                initial={{ scale: 0, rotate: 180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: -180 }}
                transition={{ duration: 0.2 }}
              >
                <Shield size={14} className="text-zinc-500" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </button>

      {/* Mode label with animated text swap */}
      <div className="flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={isAutopilot ? "autopilot" : "copilot"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-1.5"
          >
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                isAutopilot ? "text-violet-400" : "text-emerald-400"
              }`}
            >
              {isAutopilot ? "Autopilot" : "Copilot"}
            </span>

            {/* Pulsing dot indicator */}
            <motion.span
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.7, 1, 0.7],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                isAutopilot ? "bg-violet-400" : "bg-emerald-400"
              }`}
            />
          </motion.div>
        </AnimatePresence>

        <span className="text-[10px] text-muted-foreground leading-tight">
          {isAutopilot ? "Auto-dispatching reminders" : "Manual review mode"}
        </span>
      </div>
    </div>
  );
}
