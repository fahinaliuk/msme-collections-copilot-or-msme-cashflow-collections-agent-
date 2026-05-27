"use client";

import React, { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { invoicesAPI } from "@/lib/api";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  RefreshCw,
  FileWarning,
  ArrowRight
} from "lucide-react";
import Link from "next/link";

type ReviewInvoice = {
  id: string;
  invoice_id: string;
  customer_name: string;
  invoice_date: string;
  due_date: string;
  invoice_amount: number;
  amount_paid: number;
  outstanding_amount: number;
  status: string;
  days_overdue: number;
  customer_phone: string | null;
  confidence_score: number;
  validation_warnings: string | null;
  created_at: string;
};

export default function ReviewQueuePage() {
  const [invoices, setInvoices] = useState<ReviewInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filterType, setFilterType] = useState<string>("needs_review");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchQueue = async (filter?: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await invoicesAPI.getReviewQueue({ filter_type: filter });
      setInvoices(data);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load review queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue(filterType);
  }, [filterType]);

  const filteredInvoices = invoices.filter(inv => 
    inv.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.invoice_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const avgConfidence = invoices.length > 0 
    ? invoices.reduce((sum, inv) => sum + inv.confidence_score, 0) / invoices.length 
    : 0;

  const criticalCount = invoices.filter(inv => inv.confidence_score < 0.5).length;

  return (
    <DashboardLayout>
      <div className="bg-background">
                
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          
          <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl flex items-center gap-3">
                Extraction Review Queue
                <span className="flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-3 py-1 text-sm font-semibold text-yellow-600">
                  <FileWarning size={16} />
                  {invoices.length} Items
                </span>
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Invoices ingested with low confidence or validation warnings. Review data quality to ensure accurate next-best-action recommendations.
              </p>
            </div>
            
            <button 
              onClick={() => fetchQueue(filterType)}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-lg bg-card border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50 h-10"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {/* KPI Cards */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3 text-muted-foreground mb-2">
                <FileWarning size={18} className="text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider">In Queue</h3>
              </div>
              <p className="text-2xl font-black text-foreground">{invoices.length}</p>
            </div>
            
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3 text-muted-foreground mb-2">
                <AlertTriangle size={18} className="text-red-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Critical (&lt;50% Conf)</h3>
              </div>
              <p className="text-2xl font-black text-foreground">{criticalCount}</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3 text-muted-foreground mb-2">
                <CheckCircle2 size={18} className="text-blue-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Avg Confidence</h3>
              </div>
              <p className="text-2xl font-black text-foreground">{(avgConfidence * 100).toFixed(1)}%</p>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between rounded-xl bg-card border border-border p-2">
            <div className="flex items-center w-full sm:w-auto overflow-x-auto p-1 gap-1">
              <Filter size={16} className="text-muted-foreground ml-2 mr-1 shrink-0" />
              <button
                onClick={() => setFilterType("needs_review")}
                className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  filterType === "needs_review" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                Needs Review (&lt;75%)
              </button>
              <button
                onClick={() => setFilterType("duplicate")}
                className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  filterType === "duplicate" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                Duplicates
              </button>
              <button
                onClick={() => setFilterType("invalid_amount")}
                className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  filterType === "invalid_amount" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                Invalid Amounts
              </button>
              <button
                onClick={() => setFilterType("high_confidence")}
                className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  filterType === "high_confidence" ? "bg-emerald-500/10 text-emerald-600" : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                High Confidence (≥95%)
              </button>
            </div>

            <div className="relative w-full sm:w-64 pr-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search size={16} className="text-muted-foreground" />
              </div>
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full rounded-lg border-0 py-2 pl-9 pr-3 text-sm ring-1 ring-inset ring-border bg-background focus:ring-2 focus:ring-inset focus:ring-emerald-500 placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Invoice List */}
          {error ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive">
              <AlertTriangle size={24} className="mx-auto mb-2" />
              <p className="font-semibold">{error}</p>
            </div>
          ) : loading ? (
            <div className="py-20 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
              <p className="mt-4 text-sm font-medium text-muted-foreground">Loading queue...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-lg font-bold text-foreground">Queue is Empty</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                No invoices match the current filter. All your recent uploads are looking good!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {filteredInvoices.map((inv) => (
                <div key={inv.id} className="rounded-xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                  
                  <div className="flex items-center justify-between border-b border-border bg-muted/20 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full font-bold text-xs ${
                        inv.confidence_score >= 0.95 ? "bg-emerald-500/10 text-emerald-600" :
                        inv.confidence_score >= 0.75 ? "bg-yellow-500/10 text-yellow-600" :
                        "bg-red-500/10 text-red-600"
                      }`}>
                        {(inv.confidence_score * 100).toFixed(0)}%
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground text-sm">{inv.invoice_id}</h4>
                        <p className="text-xs text-muted-foreground">Extracted {new Date(inv.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <Link 
                      href={`/dashboard?search=${encodeURIComponent(inv.customer_name)}`}
                      className="text-emerald-600 hover:text-emerald-500 bg-emerald-500/10 p-2 rounded-lg transition-colors"
                      title="View Customer on Dashboard"
                    >
                      <ArrowRight size={16} />
                    </Link>
                  </div>

                  <div className="p-5 flex-grow">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Customer</p>
                        <p className="text-sm font-semibold text-foreground truncate">{inv.customer_name}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Amount</p>
                        <p className="text-sm font-semibold text-foreground">₹{inv.invoice_amount.toLocaleString("en-IN")}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Dates</p>
                        <p className="text-sm text-foreground">
                          Inv: {new Date(inv.invoice_date).toLocaleDateString()}<br/>
                          Due: {new Date(inv.due_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Status</p>
                        <p className="text-sm text-foreground flex items-center gap-1.5">
                          {inv.outstanding_amount > 0 ? (
                            <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
                          ) : (
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                          )}
                          {inv.status}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-3 mt-auto">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-2 flex items-center gap-1.5">
                        <AlertTriangle size={12} />
                        Validation Warnings
                      </p>
                      {inv.validation_warnings ? (
                        <ul className="list-disc list-inside text-xs text-red-700/80 space-y-1">
                          {inv.validation_warnings.split(", ").map((warn, i) => (
                            <li key={i}>{warn}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">None</p>
                      )}
                    </div>
                  </div>
                  
                </div>
              ))}
            </div>
          )}

        </main>
      </div>
    </DashboardLayout>
  );
}
