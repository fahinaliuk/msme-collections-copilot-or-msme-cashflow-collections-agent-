"use client";

import React, { useState, useEffect } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import Navbar from "@/components/layout/Navbar";
import { dashboardAPI, remindersAPI } from "@/lib/api";
import {
  Users,
  MessageSquare,
  Copy,
  Check,
  RotateCw,
  Phone,
  AlertTriangle,
  ChevronRight,
  Calendar,
  IndianRupee,
  FileSpreadsheet,
  ShieldAlert,
  Handshake
} from "lucide-react";

export default function CollectionsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Collections Priority list
  const [customers, setCustomers] = useState<any[]>([]);
  
  // Active generator panel state
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [tone, setTone] = useState("polite");
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [whatsappDrafts, setWhatsappDrafts] = useState<string[]>([]);
  
  // User notifications & logging
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [wasSent, setWasSent] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  const [logMessage, setLogMessage] = useState<string | null>(null);

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await dashboardAPI.getCustomers();
      setCustomers(data);
      // Automatically select first customer if available and none selected
      if (data.length > 0 && !selectedCustomer) {
        setSelectedCustomer(data[0]);
      }
    } catch (err: any) {
      setError("Failed to fetch collections priority scores. Please ensure uvicorn server is active.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Fetch drafts when customer or tone changes
  const handleGenerateDrafts = async () => {
    if (!selectedCustomer) return;
    
    setDraftsLoading(true);
    setError(null);
    setWhatsappDrafts([]);
    setCopiedIndex(null);
    setWasSent(false);
    setLogMessage(null);

    try {
      const data = await remindersAPI.generate({
        customer_name: selectedCustomer.customer_name,
        outstanding_amount: selectedCustomer.total_outstanding,
        max_days_overdue: selectedCustomer.max_overdue_days,
        tone: tone
      });
      setWhatsappDrafts(data.messages);
    } catch (err: any) {
      setError("Failed to generate reminders. Verification of OpenAI API keys or fallbacks failed.");
    } finally {
      setDraftsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCustomer) {
      // Determine default tone based on overdue days
      const days = selectedCustomer.max_overdue_days;
      if (days <= 15) {
        setTone("polite");
      } else if (days <= 45) {
        setTone("firm");
      } else {
        setTone("urgent");
      }
    }
  }, [selectedCustomer]);

  // Trigger generator when selectedCustomer or tone changes
  useEffect(() => {
    if (selectedCustomer) {
      handleGenerateDrafts();
    }
  }, [selectedCustomer, tone]);

  // Copy to clipboard
  const handleCopyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Log reminder action
  const handleLogAction = async (messageText: string) => {
    if (!selectedCustomer) return;
    setLogLoading(true);
    setLogMessage(null);

    try {
      await remindersAPI.logAction({
        customer_name: selectedCustomer.customer_name,
        action_type: "reminder",
        tone: tone,
        message_text: messageText,
        overdue_amount: selectedCustomer.total_outstanding,
        days_overdue: selectedCustomer.max_overdue_days,
        was_sent: true
      });
      setWasSent(true);
      setLogMessage("Collection action committed to ledger history.");
      // Refresh priorities list
      fetchCustomers();
    } catch (err) {
      setError("Could not log collection action.");
    } finally {
      setLogLoading(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "critical": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "high": return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "medium": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default: return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    }
  };

  return (
    <AuthGuard>
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* HEADER SECTION */}
        <div className="border-b border-border pb-6 mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Collections priority dashboard
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Compute collections priorities using outstanding scores and draft immediate ready-to-copy WhatsApp reminders.
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive font-medium">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
              <p className="text-sm text-muted-foreground">Ranking overdue accounts receivable...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT COLUMN: PRIORITY LIST (5 / 12) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Users size={16} />
                  Ranked Priority Accounts ({customers.length})
                </h3>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {customers.map((cust) => (
                  <div
                    key={cust.customer_name}
                    onClick={() => setSelectedCustomer(cust)}
                    className={`border rounded-xl p-4 cursor-pointer transition-all flex items-center justify-between ${
                      selectedCustomer?.customer_name === cust.customer_name
                        ? "border-emerald-500 bg-emerald-500/[0.04] shadow-md shadow-emerald-500/5"
                        : "border-border bg-card hover:bg-muted/30"
                    }`}
                  >
                    <div className="space-y-1 pr-3 truncate">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-foreground truncate">
                          {cust.customer_name}
                        </h4>
                        <span className={`text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border font-semibold ${getTierColor(cust.risk_tier)}`}>
                          {cust.risk_tier}
                        </span>
                      </div>
                      
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {cust.max_overdue_days} days overdue
                        </span>
                        <span className="flex items-center gap-1">
                          <FileSpreadsheet size={12} />
                          {cust.invoice_count} {cust.invoice_count === 1 ? 'inv' : 'invs'}
                        </span>
                        {cust.open_disputes_count > 0 && (
                          <span className="flex items-center gap-1 text-orange-500" title="Open disputes">
                            <ShieldAlert size={12} />
                            {cust.open_disputes_count}
                          </span>
                        )}
                        {cust.broken_promises_count > 0 && (
                          <span className="flex items-center gap-1 text-red-500" title="Broken promises">
                            <Handshake size={12} />
                            {cust.broken_promises_count}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">
                        ₹{cust.total_outstanding.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-[10px] font-semibold text-emerald-500 mt-0.5" title="Outstanding amount x days overdue">
                        Score: {Math.round(cust.priority_score).toLocaleString("en-IN")}
                      </p>
                    </div>

                  </div>
                ))}

                {customers.length === 0 && (
                  <div className="text-center py-10 border border-border border-dashed rounded-xl bg-card">
                    <p className="text-sm text-muted-foreground">No customer profiles found. Upload a spreadsheet first.</p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: GENERATOR PANEL (7 / 12) */}
            <div className="lg:col-span-7">
              {selectedCustomer ? (
                <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-lg shadow-slate-900/5 space-y-6 p-6 relative">
                  
                  {/* Glowing background */}
                  <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-emerald-500/[0.03] blur-3xl pointer-events-none"></div>

                  {/* Customer stats context header */}
                  <div className="flex flex-wrap items-center justify-between border-b border-border pb-4 gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-foreground">
                        {selectedCustomer.customer_name}
                      </h2>
                      {selectedCustomer.customer_phone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                          <Phone size={12} className="text-emerald-500" />
                          {selectedCustomer.customer_phone}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <div>
                        <span className="block text-[10px]">Overdue Balance</span>
                        <span className="text-sm font-bold text-foreground">₹{selectedCustomer.total_outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        <span className="block text-[10px]">Max Overdue</span>
                        <span className="text-sm font-bold text-foreground">{selectedCustomer.max_overdue_days} Days</span>
                      </div>
                    </div>
                  </div>

                  {/* Tone switches */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Reminder Escalation Tone
                    </label>
                    <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-muted/40 border border-border">
                      {["polite", "firm", "urgent"].map((t) => (
                        <button
                          key={t}
                          onClick={() => setTone(t)}
                          className={`rounded-lg py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                            tone === t
                              ? "bg-card text-emerald-500 shadow-sm border border-border"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message drafts previews */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <MessageSquare size={16} />
                      WhatsApp Message Drafts
                    </h3>

                    {draftsLoading ? (
                      <div className="flex h-48 items-center justify-center bg-muted/5 border border-dashed border-border rounded-xl">
                        <div className="flex flex-col items-center gap-2">
                          <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></span>
                          <span className="text-xs text-muted-foreground font-medium animate-pulse">Drafting reminder messages...</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {whatsappDrafts.map((draft, idx) => (
                          <div
                            key={idx}
                            className="border border-border rounded-xl bg-background/50 overflow-hidden hover:border-emerald-500/30 transition-all"
                          >
                            {/* Draft action header */}
                            <div className="flex items-center justify-between border-b border-border bg-muted/10 px-4 py-2 text-xs text-muted-foreground font-semibold">
                              <span>VARIANT {idx + 1}</span>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleCopyToClipboard(draft, idx)}
                                  className="flex items-center gap-1 text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded"
                                >
                                  {copiedIndex === idx ? <Check size={12} /> : <Copy size={12} />}
                                  {copiedIndex === idx ? "Copied" : "Copy Message"}
                                </button>
                                <button
                                  onClick={() => handleLogAction(draft)}
                                  disabled={logLoading || wasSent}
                                  className="flex items-center gap-1 bg-muted hover:bg-muted-foreground/15 border border-border px-2 py-1 rounded disabled:opacity-50"
                                >
                                  <Check size={12} />
                                  Log as Sent
                                </button>
                              </div>
                            </div>

                            {/* Draft body content */}
                            <div className="p-4 text-sm text-foreground whitespace-pre-line leading-relaxed font-mono">
                              {draft}
                            </div>
                          </div>
                        ))}

                        {whatsappDrafts.length === 0 && !draftsLoading && (
                          <p className="text-center text-xs text-muted-foreground py-8">
                            Select a customer to automatically draft payment reminder templates.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Audit updates confirmation logs */}
                  {logMessage && (
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold px-4.5 py-3 rounded-lg">
                      <Check size={16} />
                      {logMessage}
                    </div>
                  )}

                  {/* Manual refresh templates button */}
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleGenerateDrafts}
                      disabled={draftsLoading}
                      className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                      <RotateCw size={12} className={draftsLoading ? "animate-spin" : ""} />
                      Regenerate Messages
                    </button>
                  </div>

                </div>
              ) : (
                <div className="flex h-96 items-center justify-center border border-border border-dashed rounded-2xl bg-card">
                  <div className="text-center space-y-2">
                    <Users size={32} className="mx-auto text-muted-foreground/50" />
                    <h4 className="font-semibold text-foreground">No customer selected</h4>
                    <p className="text-xs text-muted-foreground">Choose a ranked customer from the priority panel to draft reminders.</p>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
    </AuthGuard>
  );
}
