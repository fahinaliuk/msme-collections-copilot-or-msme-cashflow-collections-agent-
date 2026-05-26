"use client";

import React, { useState, useEffect, useCallback } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import Navbar from "@/components/layout/Navbar";
import { dashboardAPI, timelineAPI, worklistAPI } from "@/lib/api";
import {
  Clock,
  MessageSquare,
  Phone,
  Handshake,
  ShieldAlert,
  StickyNote,
  AlertTriangle,
  ChevronDown,
  Check,
  PhoneCall,
  X,
  Search,
  CalendarDays,
  Send,
  Copy,
  FileText,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Event type → icon / color mapping
// ---------------------------------------------------------------------------
const EVENT_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string; borderColor: string }
> = {
  whatsapp_draft_generated: {
    label: "WhatsApp Draft Generated",
    icon: MessageSquare,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
  },
  whatsapp_copied: {
    label: "WhatsApp Copied",
    icon: Copy,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
  },
  whatsapp_sent_manual: {
    label: "WhatsApp Sent",
    icon: Send,
    color: "text-green-400",
    bg: "bg-green-500/10",
    borderColor: "border-green-500/30",
  },
  call_logged: {
    label: "Call Logged",
    icon: Phone,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  promise_to_pay_created: {
    label: "Promise Created",
    icon: Handshake,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
  },
  promise_to_pay_broken: {
    label: "Promise Broken",
    icon: Handshake,
    color: "text-red-400",
    bg: "bg-red-500/10",
    borderColor: "border-red-500/30",
  },
  dispute_opened: {
    label: "Dispute Opened",
    icon: ShieldAlert,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
  },
  dispute_resolved: {
    label: "Dispute Resolved",
    icon: Check,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
  },
  note_added: {
    label: "Note Added",
    icon: StickyNote,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
  },
};

const DEFAULT_EVENT_CONFIG = {
  label: "Event",
  icon: FileText,
  color: "text-slate-400",
  bg: "bg-slate-500/10",
  borderColor: "border-slate-500/30",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TimelineEvent {
  id: string;
  customer_name: string;
  event_type: string;
  description: string | null;
  metadata_json: string | null;
  created_at: string;
}

interface CustomerItem {
  customer_name: string;
  customer_phone: string | null;
  total_outstanding: number;
  max_overdue_days: number;
  risk_tier: string;
}

// Group events by date
function groupByDate(events: TimelineEvent[]): Record<string, TimelineEvent[]> {
  const groups: Record<string, TimelineEvent[]> = {};
  events.forEach((evt) => {
    const dateKey = new Date(evt.created_at).toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(evt);
  });
  return groups;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ---------------------------------------------------------------------------
// Quick action modal
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/30 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{customerName}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
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
export default function TimelinePage() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [callDesc, setCallDesc] = useState("");
  const [callPhone, setCallPhone] = useState("");
  const [callDuration, setCallDuration] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDesc, setNoteDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch customers
  useEffect(() => {
    (async () => {
      setCustomersLoading(true);
      try {
        const data = await dashboardAPI.getCustomers();
        setCustomers(data);
        if (data.length > 0) {
          setSelectedCustomer(data[0].customer_name);
        }
      } catch {
        setError("Failed to load customers.");
      } finally {
        setCustomersLoading(false);
      }
    })();
  }, []);

  // Fetch timeline when customer changes
  const fetchTimeline = useCallback(async () => {
    if (!selectedCustomer) return;
    setLoading(true);
    setError(null);
    try {
      const data = await timelineAPI.list(selectedCustomer, 100);
      setEvents(data);
    } catch {
      setError("Failed to load timeline.");
    } finally {
      setLoading(false);
    }
  }, [selectedCustomer]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  const grouped = groupByDate(events);

  // Filtered customers for search
  const filteredCustomers = customers.filter((c) =>
    c.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedInfo = customers.find(
    (c) => c.customer_name === selectedCustomer
  );

  const TIER_COLORS: Record<string, string> = {
    critical: "bg-red-500/10 text-red-500 border-red-500/20",
    high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    low: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  };

  // Submit handlers
  const handleCallSubmit = async () => {
    if (!callDesc.trim()) return;
    setSubmitting(true);
    try {
      await worklistAPI.logCall({
        customer_name: selectedCustomer,
        description: callDesc,
        phone_number: callPhone || undefined,
        duration_seconds: callDuration ? parseInt(callDuration) : undefined,
        notes: callNotes || undefined,
      });
      setSuccessMsg("Call logged successfully");
      setCallModalOpen(false);
      setCallDesc("");
      setCallPhone("");
      setCallDuration("");
      setCallNotes("");
      fetchTimeline();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError("Failed to log call.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNoteSubmit = async () => {
    if (!noteTitle.trim() || !noteDesc.trim()) return;
    setSubmitting(true);
    try {
      await worklistAPI.addNote({
        customer_name: selectedCustomer,
        title: noteTitle,
        description: noteDesc,
      });
      setSuccessMsg("Note added successfully");
      setNoteModalOpen(false);
      setNoteTitle("");
      setNoteDesc("");
      fetchTimeline();
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-500">
                <Clock size={22} />
              </div>
              Customer Timeline
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Full communication history per customer — calls, messages, promises, disputes, and notes.
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* LEFT: Customer selector */}
            <div className="lg:col-span-4 space-y-4">
              {/* Search input */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card pl-9 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              {/* Customer list */}
              <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                {customersLoading ? (
                  <div className="flex h-32 items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent" />
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-border rounded-xl bg-card">
                    <p className="text-xs text-muted-foreground">No customers found.</p>
                  </div>
                ) : (
                  filteredCustomers.map((cust) => (
                    <button
                      key={cust.customer_name}
                      onClick={() => setSelectedCustomer(cust.customer_name)}
                      className={`w-full text-left rounded-xl p-4 border transition-all ${
                        selectedCustomer === cust.customer_name
                          ? "border-emerald-500 bg-emerald-500/[0.04] shadow-md shadow-emerald-500/5"
                          : "border-border bg-card hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-foreground text-sm truncate">
                              {cust.customer_name}
                            </h4>
                            <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border font-bold ${TIER_COLORS[cust.risk_tier] || TIER_COLORS.low}`}>
                              {cust.risk_tier}
                            </span>
                          </div>
                          <div className="flex gap-3 text-[11px] text-muted-foreground">
                            <span>₹{cust.total_outstanding.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                            <span>{cust.max_overdue_days}d overdue</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* RIGHT: Timeline */}
            <div className="lg:col-span-8">
              {selectedCustomer ? (
                <div className="space-y-6">
                  {/* Customer header + quick actions */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border border-border rounded-xl bg-card p-5">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">{selectedCustomer}</h2>
                      {selectedInfo && (
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          <span>Outstanding: <span className="font-bold text-foreground">₹{selectedInfo.total_outstanding.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span></span>
                          <span>Overdue: <span className="font-bold text-foreground">{selectedInfo.max_overdue_days} days</span></span>
                          {selectedInfo.customer_phone && (
                            <span className="flex items-center gap-1">
                              <Phone size={11} className="text-emerald-500" />
                              {selectedInfo.customer_phone}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCallModalOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                      >
                        <PhoneCall size={13} />
                        Log Call
                      </button>
                      <button
                        onClick={() => setNoteModalOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors shadow-sm"
                      >
                        <StickyNote size={13} />
                        Add Note
                      </button>
                    </div>
                  </div>

                  {/* Timeline events */}
                  {loading ? (
                    <div className="flex h-48 items-center justify-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-7 w-7 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent" />
                        <p className="text-xs text-muted-foreground">Loading timeline…</p>
                      </div>
                    </div>
                  ) : events.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 border border-dashed border-border rounded-2xl bg-card">
                      <Clock size={40} className="text-muted-foreground/30 mb-3" />
                      <h3 className="text-base font-semibold text-foreground mb-1">No events yet</h3>
                      <p className="text-xs text-muted-foreground max-w-xs text-center">
                        Communication events will appear here when you send reminders, log calls, or create promises.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {Object.entries(grouped).map(([dateLabel, dateEvents]) => (
                        <div key={dateLabel}>
                          {/* Date header */}
                          <div className="flex items-center gap-3 mb-4">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
                              <CalendarDays size={13} className="text-muted-foreground" />
                              <span className="text-xs font-bold text-foreground">{dateLabel}</span>
                            </div>
                            <div className="flex-1 h-px bg-border" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                              {dateEvents.length} event{dateEvents.length > 1 ? "s" : ""}
                            </span>
                          </div>

                          {/* Events */}
                          <div className="relative ml-6">
                            {/* Vertical line */}
                            <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />

                            <div className="space-y-4">
                              {dateEvents.map((evt) => {
                                const cfg = EVENT_CONFIG[evt.event_type] || DEFAULT_EVENT_CONFIG;
                                const EvtIcon = cfg.icon;

                                return (
                                  <div key={evt.id} className="relative pl-8 group">
                                    {/* Timeline dot */}
                                    <div className={`absolute left-0 top-3 -translate-x-1/2 flex h-7 w-7 items-center justify-center rounded-full border-2 ${cfg.borderColor} ${cfg.bg} transition-transform group-hover:scale-110`}>
                                      <EvtIcon size={13} className={cfg.color} />
                                    </div>

                                    {/* Event card */}
                                    <div className="rounded-xl border border-border bg-card p-4 hover:border-emerald-500/20 transition-all hover:shadow-md hover:shadow-emerald-500/5">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${cfg.bg} ${cfg.color} ${cfg.borderColor}`}>
                                              {cfg.label}
                                            </span>
                                          </div>
                                          {evt.description && (
                                            <p className="text-sm text-foreground/80 leading-relaxed mt-1">
                                              {evt.description}
                                            </p>
                                          )}
                                        </div>
                                        <span className="text-[10px] font-medium text-muted-foreground shrink-0 mt-0.5">
                                          {formatTime(evt.created_at)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-2xl bg-card">
                  <Clock size={48} className="text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-1">Select a customer</h3>
                  <p className="text-sm text-muted-foreground max-w-sm text-center">
                    Choose a customer from the list to view their communication timeline.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LOG CALL MODAL */}
        <QuickActionModal
          isOpen={callModalOpen}
          onClose={() => setCallModalOpen(false)}
          title="Log Phone Call"
          customerName={selectedCustomer}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Call Summary *</label>
              <textarea
                value={callDesc}
                onChange={(e) => setCallDesc(e.target.value)}
                placeholder="Discussed overdue payment…"
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Phone Number</label>
                <input type="text" value={callPhone} onChange={(e) => setCallPhone(e.target.value)} placeholder="+91 98765…" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Duration (sec)</label>
                <input type="number" value={callDuration} onChange={(e) => setCallDuration(e.target.value)} placeholder="120" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Notes</label>
              <input type="text" value={callNotes} onChange={(e) => setCallNotes(e.target.value)} placeholder="Follow up in 3 days…" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
            <button
              onClick={handleCallSubmit}
              disabled={submitting || !callDesc.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <PhoneCall size={14} />}
              Log Call
            </button>
          </div>
        </QuickActionModal>

        {/* ADD NOTE MODAL */}
        <QuickActionModal
          isOpen={noteModalOpen}
          onClose={() => setNoteModalOpen(false)}
          title="Add Note"
          customerName={selectedCustomer}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Title *</label>
              <input type="text" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Payment update" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Description *</label>
              <textarea value={noteDesc} onChange={(e) => setNoteDesc(e.target.value)} placeholder="Customer mentioned they will pay by end of month…" rows={4} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none" />
            </div>
            <button
              onClick={handleNoteSubmit}
              disabled={submitting || !noteTitle.trim() || !noteDesc.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <StickyNote size={14} />}
              Add Note
            </button>
          </div>
        </QuickActionModal>
      </div>
    </AuthGuard>
  );
}
