"use client";

import React, { useState, useEffect } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import Navbar from "@/components/layout/Navbar";
import { disputesAPI } from "@/lib/api";
import {
  ShieldAlert,
  AlertCircle,
  Plus,
  SearchCheck,
  XCircle,
  Eye,
} from "lucide-react";

const REASON_LABELS: Record<string, string> = {
  pricing_issue: "Pricing Issue",
  duplicate_invoice: "Duplicate Invoice",
  goods_not_delivered: "Goods Not Delivered",
  payment_already_done: "Payment Already Done",
  wrong_customer_details: "Wrong Customer Details",
  other: "Other",
};

export default function DisputesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");

  const [showCreate, setShowCreate] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [reason, setReason] = useState("pricing_issue");
  const [description, setDescription] = useState("");
  const [disputedAmount, setDisputedAmount] = useState("");

  // Resolve modal
  const [resolveDispute, setResolveDispute] = useState<any | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolveAction, setResolveAction] = useState("resolved");

  const fetchDisputes = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (statusFilter !== "all") params.status = statusFilter;
      const data = await disputesAPI.list(params);
      setDisputes(data);
    } catch (err) {
      setError("Failed to load disputes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, [statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await disputesAPI.create({
        customer_name: customerName,
        invoice_id: invoiceId || undefined,
        reason,
        description: description || undefined,
        disputed_amount: disputedAmount ? parseFloat(disputedAmount) : 0,
      });
      setShowCreate(false);
      setCustomerName("");
      setInvoiceId("");
      setReason("pricing_issue");
      setDescription("");
      setDisputedAmount("");
      fetchDisputes();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create dispute.");
    }
  };

  const handleResolve = async () => {
    if (!resolveDispute) return;
    try {
      await disputesAPI.update(resolveDispute.id, {
        status: resolveAction,
        resolution_notes: resolutionNotes || undefined,
      });
      setResolveDispute(null);
      setResolutionNotes("");
      fetchDisputes();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update dispute.");
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "resolved":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "rejected":
        return "bg-gray-500/10 text-gray-400 border-gray-500/20";
      case "under_review":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      default:
        return "bg-red-500/10 text-red-500 border-red-500/20";
    }
  };

  const filtered = statusFilter === "all" ? disputes : disputes.filter(d => d.status === statusFilter);

  return (
    <AuthGuard>
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6 mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Invoice Disputes
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Track and resolve customer invoice disputes.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition-all shrink-0"
          >
            <Plus size={16} />
            Open Dispute
          </button>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive font-medium">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <div className="flex gap-2 mb-6 flex-wrap">
          {["all", "open", "under_review", "resolved", "rejected"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider border transition-all ${
                statusFilter === s
                  ? "bg-emerald-600/10 text-emerald-500 border-emerald-500/30"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {s === "all" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></span>
              <span className="text-sm text-muted-foreground">Loading disputes...</span>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/10">
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Invoice</th>
                    <th className="px-6 py-4">Reason</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {filtered.map((d: any) => (
                    <tr key={d.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4 font-semibold text-foreground">{d.customer_name}</td>
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{d.invoice_id || "—"}</td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">{REASON_LABELS[d.reason] || d.reason}</td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">
                        {d.disputed_amount > 0 ? `₹${d.disputed_amount.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block border rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getStatusStyle(d.status)}`}>
                          {d.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {d.status === "open" ? (
                          <button
                            onClick={() => { setResolveDispute(d); setResolveAction("resolved"); }}
                            className="flex items-center gap-1 text-xs font-semibold text-emerald-500 hover:text-emerald-400"
                          >
                            <SearchCheck size={14} />
                            Resolve
                          </button>
                        ) : d.status === "under_review" ? (
                          <button
                            onClick={() => { setResolveDispute(d); setResolveAction("resolved"); }}
                            className="flex items-center gap-1 text-xs font-semibold text-blue-500 hover:text-blue-400"
                          >
                            <Eye size={14} />
                            Review
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">{d.resolution_notes || "—"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground">
                        No disputes found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="bg-muted/10 border-t border-border px-6 py-3 text-xs font-semibold text-muted-foreground">
              Total: {filtered.length} dispute(s)
            </div>
          </div>
        )}

        {/* Create dispute modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-foreground mb-4">Open Dispute</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Customer Name *</label>
                  <input
                    required
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background/50 px-3.5 py-2.5 text-sm text-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Ramesh Kumar"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Invoice ID (optional)</label>
                  <input
                    value={invoiceId}
                    onChange={e => setInvoiceId(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background/50 px-3.5 py-2.5 text-sm text-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="INV-001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Reason *</label>
                  <select
                    required
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background/50 px-3.5 py-2.5 text-sm text-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {Object.entries(REASON_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Disputed Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={disputedAmount}
                    onChange={e => setDisputedAmount(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background/50 px-3.5 py-2.5 text-sm text-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Description</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-input bg-background/50 px-3.5 py-2.5 text-sm text-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Describe the issue..."
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
                  <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500">Open Dispute</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Resolve/reject modal */}
        {resolveDispute && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-foreground mb-1">Resolve Dispute</h3>
              <p className="text-xs text-muted-foreground mb-4">{resolveDispute.customer_name} — {REASON_LABELS[resolveDispute.reason]}</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Action</label>
                  <div className="flex gap-2">
                    {["resolved", "rejected", "under_review"].map((a) => (
                      <button
                        key={a}
                        onClick={() => setResolveAction(a)}
                        className={`rounded-lg px-3.5 py-2 text-xs font-semibold border transition-all ${
                          resolveAction === a
                            ? "bg-emerald-600/10 text-emerald-500 border-emerald-500/30"
                            : "bg-card text-muted-foreground border-border hover:text-foreground"
                        }`}
                      >
                        {a.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Resolution Notes</label>
                  <textarea
                    value={resolutionNotes}
                    onChange={e => setResolutionNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-input bg-background/50 px-3.5 py-2.5 text-sm text-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="How was this resolved?"
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button onClick={() => setResolveDispute(null)} className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
                  <button onClick={handleResolve} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500">Apply</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
    </AuthGuard>
  );
}