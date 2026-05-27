"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { promisesAPI } from "@/lib/api";
import {
  Handshake,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  IndianRupee,
  Calendar,
  Plus,
} from "lucide-react";

export default function PromisesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [promises, setPromises] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");

  // Create promise modal
  const [showCreate, setShowCreate] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [promisedAmount, setPromisedAmount] = useState("");
  const [promisedDate, setPromisedDate] = useState("");
  const [notes, setNotes] = useState("");

  const fetchPromises = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (statusFilter !== "all") params.status = statusFilter;
      const data = await promisesAPI.list(params);
      setPromises(data);
    } catch (err) {
      setError("Failed to load promises to pay.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromises();
  }, [statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await promisesAPI.create({
        customer_name: customerName,
        invoice_id: invoiceId || undefined,
        promised_amount: parseFloat(promisedAmount),
        promised_date: promisedDate,
        notes: notes || undefined,
      });
      setShowCreate(false);
      setCustomerName("");
      setInvoiceId("");
      setPromisedAmount("");
      setPromisedDate("");
      setNotes("");
      fetchPromises();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create promise.");
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await promisesAPI.update(id, { status });
      fetchPromises();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update promise.");
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "fulfilled":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "broken":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "cancelled":
        return "bg-gray-500/10 text-gray-400 border-gray-500/20";
      default:
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    }
  };

  const today = new Date().toISOString().split("T")[0];

  const filtered = statusFilter === "all" ? promises : promises.filter(p => p.status === statusFilter);

  return (
    <DashboardLayout>
    <div className="bg-background">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6 mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Promises to Pay
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Track customer payment promises, mark as fulfilled, broken, or cancelled.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition-all shrink-0"
          >
            <Plus size={16} />
            Record Promise
          </button>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive font-medium">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Status filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {["all", "pending", "fulfilled", "broken", "cancelled"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider border transition-all ${
                statusFilter === s
                  ? "bg-emerald-600/10 text-emerald-500 border-emerald-500/30"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></span>
              <span className="text-sm text-muted-foreground">Loading promises...</span>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/10">
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Invoice</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                    <th className="px-6 py-4">Promise Date</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Notes</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {filtered.map((p: any) => (
                    <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4 font-semibold text-foreground">{p.customer_name}</td>
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{p.invoice_id || "—"}</td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">
                        ₹{p.promised_amount.toLocaleString("en-IN")}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{p.promised_date}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block border rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getStatusStyle(p.status)}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground max-w-[150px] truncate">{p.notes || "—"}</td>
                      <td className="px-6 py-4 text-center">
                        {p.status === "pending" && (
                          <div className="flex gap-1.5 justify-center">
                            <button
                              onClick={() => handleUpdateStatus(p.id, "fulfilled")}
                              className="p-1.5 rounded bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                              title="Mark fulfilled"
                            >
                              <CheckCircle size={14} />
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(p.id, "broken")}
                              className="p-1.5 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20"
                              title="Mark broken"
                            >
                              <XCircle size={14} />
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(p.id, "cancelled")}
                              className="p-1.5 rounded bg-gray-500/10 text-gray-400 hover:bg-gray-500/20"
                              title="Cancel"
                            >
                              <Clock size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-muted-foreground">
                        No promises to pay found. Record a promise to track customer commitments.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="bg-muted/10 border-t border-border px-6 py-3 text-xs font-semibold text-muted-foreground">
              Total: {filtered.length} promise(s)
            </div>
          </div>
        )}

        {/* Create promise modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-foreground mb-4">Record Promise to Pay</h3>
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Amount *</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0"
                      value={promisedAmount}
                      onChange={e => setPromisedAmount(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background/50 px-3.5 py-2.5 text-sm text-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="50000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Promise Date *</label>
                    <input
                      required
                      type="date"
                      value={promisedDate}
                      onChange={e => setPromisedDate(e.target.value)}
                      min={today}
                      className="w-full rounded-lg border border-input bg-background/50 px-3.5 py-2.5 text-sm text-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Notes</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-input bg-background/50 px-3.5 py-2.5 text-sm text-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Any details..."
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    Create Promise
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
    </DashboardLayout>
  );
}