"use client";

import React, { useState, useEffect, useCallback } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import Navbar from "@/components/layout/Navbar";
import { worklistAPI } from "@/lib/api";
import {
  ClipboardList,
  AlertTriangle,
  Phone,
  MessageSquare,
  ShieldAlert,
  Handshake,
  Clock,
  Eye,
  ChevronDown,
  ArrowUpRight,
  Flame,
  PhoneCall,
  StickyNote,
  X,
  Check,
  RotateCw,
  Filter,
  Zap,
  TrendingUp,
  Users,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Action label / icon / color mapping
// ---------------------------------------------------------------------------
const ACTION_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  send_polite_whatsapp: {
    label: "Polite WhatsApp",
    icon: MessageSquare,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  send_firm_whatsapp: {
    label: "Firm WhatsApp",
    icon: MessageSquare,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
  },
  call_customer: {
    label: "Call Customer",
    icon: Phone,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  escalate_to_owner: {
    label: "Escalate",
    icon: Flame,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
  },
  follow_up_on_promise: {
    label: "Follow-up Promise",
    icon: Handshake,
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
  },
  resolve_dispute: {
    label: "Resolve Dispute",
    icon: ShieldAlert,
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
  },
  wait_until_due_date: {
    label: "Wait",
    icon: Clock,
    color: "text-slate-400",
    bg: "bg-slate-500/10 border-slate-500/20",
  },
  verify_invoice_data: {
    label: "Verify Data",
    icon: Eye,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
  },
};

const TIER_COLORS: Record<string, string> = {
  critical: "bg-red-500/10 text-red-500 border-red-500/20",
  high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  low: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

const URGENCY_COLORS = (score: number) => {
  if (score >= 80) return "text-red-400";
  if (score >= 60) return "text-orange-400";
  if (score >= 40) return "text-yellow-400";
  return "text-slate-400";
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface WorklistItem {
  customer_id: string | null;
  customer_name: string;
  recommended_action: string;
  reason: string;
  urgency_score: number;
  affected_invoices: any[];
  suggested_channel: string;
  risk_tier: string;
  total_outstanding: number;
  max_days_overdue: number;
  open_dispute: boolean;
  broken_promise: boolean;
  pending_promise: boolean;
}

// ---------------------------------------------------------------------------
// Modal component
// ---------------------------------------------------------------------------
function QuickActionModal({
  isOpen,
  onClose,
  title,
  customerName,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  customerName: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/30 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {customerName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function WorklistPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<WorklistItem[]>([]);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>("");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("");
  const [tierFilter, setTierFilter] = useState<string>("");

  // Modals
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [activeCustomer, setActiveCustomer] = useState<string>("");

  // Modal form state
  const [callDesc, setCallDesc] = useState("");
  const [callPhone, setCallPhone] = useState("");
  const [callDuration, setCallDuration] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDesc, setNoteDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchWorklist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (actionFilter) params.action_type = actionFilter;
      if (urgencyFilter) params.min_urgency = parseInt(urgencyFilter);
      if (tierFilter) params.risk_tier = tierFilter;
      const data = await worklistAPI.getWorklist(params);
      setItems(data);
    } catch (err: any) {
      setError("Failed to fetch worklist. Ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  }, [actionFilter, urgencyFilter, tierFilter]);

  useEffect(() => {
    fetchWorklist();
  }, [fetchWorklist]);

  // KPI summaries
  const totalActions = items.length;
  const highUrgencyCount = items.filter((i) => i.urgency_score >= 75).length;
  const actionCounts: Record<string, number> = {};
  items.forEach((i) => {
    actionCounts[i.recommended_action] =
      (actionCounts[i.recommended_action] || 0) + 1;
  });
  const topAction =
    Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  // Call submit
  const handleCallSubmit = async () => {
    if (!callDesc.trim()) return;
    setSubmitting(true);
    try {
      await worklistAPI.logCall({
        customer_name: activeCustomer,
        description: callDesc,
        phone_number: callPhone || undefined,
        duration_seconds: callDuration ? parseInt(callDuration) : undefined,
        notes: callNotes || undefined,
      });
      setSuccessMsg(`Call logged for ${activeCustomer}`);
      setCallModalOpen(false);
      setCallDesc("");
      setCallPhone("");
      setCallDuration("");
      setCallNotes("");
      fetchWorklist();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError("Failed to log call.");
    } finally {
      setSubmitting(false);
    }
  };

  // Note submit
  const handleNoteSubmit = async () => {
    if (!noteTitle.trim() || !noteDesc.trim()) return;
    setSubmitting(true);
    try {
      await worklistAPI.addNote({
        customer_name: activeCustomer,
        title: noteTitle,
        description: noteDesc,
      });
      setSuccessMsg(`Note added for ${activeCustomer}`);
      setNoteModalOpen(false);
      setNoteTitle("");
      setNoteDesc("");
      fetchWorklist();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError("Failed to add note.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* HEADER */}
          <div className="border-b border-border pb-6 mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-500">
                <ClipboardList size={22} />
              </div>
              Today&apos;s Worklist
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              AI-prioritized next-best-actions across all your customers.
              Resolve disputes, follow up on promises, and send reminders — all
              from one place.
            </p>
          </div>

          {/* SUCCESS TOAST */}
          {successMsg && (
            <div className="mb-6 flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-500 font-semibold animate-in slide-in-from-top-2 duration-300">
              <Check size={18} />
              {successMsg}
            </div>
          )}

          {/* ERROR TOAST */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive font-medium">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* KPI CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="glow-card rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Total Actions
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {totalActions}
                  </p>
                </div>
              </div>
            </div>
            <div className="glow-card rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
                  <Zap size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    High Urgency
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {highUrgencyCount}
                  </p>
                </div>
              </div>
            </div>
            <div className="glow-card rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Top Action
                  </p>
                  <p className="text-lg font-bold text-foreground truncate">
                    {ACTION_CONFIG[topAction]?.label || topAction}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* FILTER BAR */}
          <div className="flex flex-wrap items-center gap-3 mb-6 p-4 rounded-xl border border-border bg-card/50">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Filter size={14} />
              Filters
            </div>

            {/* Action type filter */}
            <div className="relative">
              <select
                id="filter-action-type"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="appearance-none rounded-lg border border-border bg-background px-3 py-2 pr-8 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all cursor-pointer"
              >
                <option value="">All Actions</option>
                {Object.entries(ACTION_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
            </div>

            {/* Urgency filter */}
            <div className="relative">
              <select
                id="filter-urgency"
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value)}
                className="appearance-none rounded-lg border border-border bg-background px-3 py-2 pr-8 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all cursor-pointer"
              >
                <option value="">All Urgency</option>
                <option value="80">High (≥80)</option>
                <option value="60">Medium+ (≥60)</option>
                <option value="40">Low+ (≥40)</option>
              </select>
              <ChevronDown
                size={12}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
            </div>

            {/* Risk tier filter */}
            <div className="relative">
              <select
                id="filter-risk-tier"
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="appearance-none rounded-lg border border-border bg-background px-3 py-2 pr-8 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all cursor-pointer"
              >
                <option value="">All Risk Tiers</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <ChevronDown
                size={12}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
            </div>

            {/* Refresh */}
            <button
              onClick={fetchWorklist}
              disabled={loading}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <RotateCw size={12} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {/* WORKLIST */}
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
                <p className="text-sm text-muted-foreground">
                  Generating next-best-actions…
                </p>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-2xl bg-card">
              <ClipboardList
                size={48}
                className="text-muted-foreground/30 mb-4"
              />
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Worklist is empty
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm text-center">
                No actionable items match your filters. Try adjusting filters or
                upload more invoices.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, idx) => {
                const actionCfg =
                  ACTION_CONFIG[item.recommended_action] ||
                  ACTION_CONFIG.wait_until_due_date;
                const ActionIcon = actionCfg.icon;

                return (
                  <div
                    key={`${item.customer_name}-${idx}`}
                    className="group rounded-xl border border-border bg-card hover:border-emerald-500/30 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/5"
                  >
                    <div className="p-5">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        {/* Left: urgency indicator + customer info */}
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          {/* Urgency score circle */}
                          <div className="relative shrink-0">
                            <div
                              className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${
                                item.urgency_score >= 80
                                  ? "border-red-500/50 bg-red-500/10"
                                  : item.urgency_score >= 60
                                  ? "border-orange-500/50 bg-orange-500/10"
                                  : item.urgency_score >= 40
                                  ? "border-yellow-500/50 bg-yellow-500/10"
                                  : "border-slate-500/50 bg-slate-500/10"
                              }`}
                            >
                              <span
                                className={`text-sm font-bold ${URGENCY_COLORS(
                                  item.urgency_score
                                )}`}
                              >
                                {item.urgency_score}
                              </span>
                            </div>
                          </div>

                          {/* Customer details */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h3 className="text-base font-bold text-foreground truncate">
                                {item.customer_name}
                              </h3>
                              <span
                                className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border font-bold ${
                                  TIER_COLORS[item.risk_tier] ||
                                  TIER_COLORS.low
                                }`}
                              >
                                {item.risk_tier}
                              </span>
                              {item.open_dispute && (
                                <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border font-bold bg-orange-500/10 text-orange-400 border-orange-500/20">
                                  Dispute
                                </span>
                              )}
                              {item.broken_promise && (
                                <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border font-bold bg-red-500/10 text-red-400 border-red-500/20">
                                  Broken Promise
                                </span>
                              )}
                              {item.pending_promise && (
                                <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border font-bold bg-purple-500/10 text-purple-400 border-purple-500/20">
                                  Pending Promise
                                </span>
                              )}
                            </div>

                            {/* Action badge */}
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span
                                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border ${actionCfg.bg} ${actionCfg.color}`}
                              >
                                <ActionIcon size={13} />
                                {actionCfg.label}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                via{" "}
                                <span className="font-medium text-foreground/70">
                                  {item.suggested_channel}
                                </span>
                              </span>
                            </div>

                            {/* Reason */}
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {item.reason}
                            </p>
                          </div>
                        </div>

                        {/* Right: stats + quick actions */}
                        <div className="flex flex-col items-end gap-3 shrink-0 lg:min-w-[200px]">
                          <div className="flex gap-4 text-right">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Outstanding
                              </p>
                              <p className="text-sm font-bold text-foreground">
                                ₹
                                {item.total_outstanding.toLocaleString(
                                  "en-IN",
                                  { maximumFractionDigits: 0 }
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Overdue
                              </p>
                              <p className="text-sm font-bold text-foreground">
                                {item.max_days_overdue}d
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Invoices
                              </p>
                              <p className="text-sm font-bold text-foreground">
                                {item.affected_invoices.length}
                              </p>
                            </div>
                          </div>

                          {/* Quick action buttons */}
                          <div className="flex items-center gap-2">
                            {(item.recommended_action ===
                              "send_polite_whatsapp" ||
                              item.recommended_action ===
                                "send_firm_whatsapp") && (
                              <a
                                href={`/collections`}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors shadow-sm"
                              >
                                <MessageSquare size={12} />
                                Draft WhatsApp
                                <ArrowUpRight size={10} />
                              </a>
                            )}
                            <button
                              onClick={() => {
                                setActiveCustomer(item.customer_name);
                                setCallModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                            >
                              <PhoneCall size={12} />
                              Log Call
                            </button>
                            <button
                              onClick={() => {
                                setActiveCustomer(item.customer_name);
                                setNoteModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                            >
                              <StickyNote size={12} />
                              Note
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* LOG CALL MODAL */}
        <QuickActionModal
          isOpen={callModalOpen}
          onClose={() => setCallModalOpen(false)}
          title="Log Phone Call"
          customerName={activeCustomer}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Call Summary *
              </label>
              <textarea
                value={callDesc}
                onChange={(e) => setCallDesc(e.target.value)}
                placeholder="Discussed overdue payment of ₹25,000…"
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={callPhone}
                  onChange={(e) => setCallPhone(e.target.value)}
                  placeholder="+91 98765..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Duration (seconds)
                </label>
                <input
                  type="number"
                  value={callDuration}
                  onChange={(e) => setCallDuration(e.target.value)}
                  placeholder="120"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Notes
              </label>
              <input
                type="text"
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                placeholder="Follow up in 3 days…"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <button
              onClick={handleCallSubmit}
              disabled={submitting || !callDesc.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <PhoneCall size={14} />
              )}
              Log Call
            </button>
          </div>
        </QuickActionModal>

        {/* ADD NOTE MODAL */}
        <QuickActionModal
          isOpen={noteModalOpen}
          onClose={() => setNoteModalOpen(false)}
          title="Add Note"
          customerName={activeCustomer}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Title *
              </label>
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Payment update"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Description *
              </label>
              <textarea
                value={noteDesc}
                onChange={(e) => setNoteDesc(e.target.value)}
                placeholder="Customer mentioned they will pay by end of month…"
                rows={4}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
              />
            </div>
            <button
              onClick={handleNoteSubmit}
              disabled={
                submitting || !noteTitle.trim() || !noteDesc.trim()
              }
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <StickyNote size={14} />
              )}
              Add Note
            </button>
          </div>
        </QuickActionModal>
      </div>
    </AuthGuard>
  );
}
