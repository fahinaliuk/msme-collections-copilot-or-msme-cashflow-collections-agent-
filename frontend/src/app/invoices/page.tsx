"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { invoicesAPI } from "@/lib/api";
import { 
  FileSpreadsheet, 
  Search, 
  Filter, 
  IndianRupee, 
  Calendar,
  AlertCircle
} from "lucide-react";

export default function InvoicesListPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  
  // Filtering & search states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const fetchInvoices = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await invoicesAPI.list();
        setInvoices(data);
      } catch (err) {
        setError("Failed to load invoice records. Please check your backend.");
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "partially paid": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default: return "bg-red-500/10 text-red-500 border-red-500/20";
    }
  };

  // Filter logic
  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch = 
      inv.invoice_id.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer_name.toLowerCase().includes(search.toLowerCase());
      
    const matchesStatus = 
      statusFilter === "all" || 
      inv.status.toLowerCase() === statusFilter.toLowerCase();
      
    return matchesSearch && matchesStatus;
  });

  return (
    <DashboardLayout>
    <div className="bg-background">
            
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* HEADER SECTION */}
        <div className="border-b border-border pb-6 mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Invoices Ledger
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Complete database of committed accounts receivables, invoice structures, and payment balances.
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive font-medium">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* SEARCH AND FILTERS TOOLBAR */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-card border border-border rounded-xl p-4 mb-6 shadow-md shadow-slate-900/5 w-full">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-3 text-muted-foreground/60" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-input bg-background/50 pl-10 pr-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Search by invoice ID or customer name..."
            />
          </div>

          <div className="flex gap-2 items-center w-full sm:w-auto shrink-0 justify-end">
            <Filter size={14} className="text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-input bg-card px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">All statuses</option>
              <option value="unpaid">Unpaid</option>
              <option value="partially paid">Partially Paid</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>

        {/* MAIN DATA GRID SHEET */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></span>
              <span className="text-sm text-muted-foreground">Reading ledger sheets...</span>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-slate-900/5">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/10">
                    <th className="px-6 py-4 w-[120px]">Invoice ID</th>
                    <th className="px-6 py-4">Customer Name</th>
                    <th className="px-6 py-4 w-[130px]">Inv Date</th>
                    <th className="px-6 py-4 w-[130px]">Due Date</th>
                    <th className="px-6 py-4 w-[130px] text-right">Total Amount</th>
                    <th className="px-6 py-4 w-[130px] text-right">Outstanding</th>
                    <th className="px-6 py-4 w-[120px] text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-foreground">{inv.invoice_id}</td>
                      <td className="px-6 py-4 font-medium text-foreground">{inv.customer_name}</td>
                      <td className="px-6 py-4 text-xs font-medium text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={13} />
                          {inv.invoice_date}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={13} />
                          {inv.due_date}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">
                        ₹{inv.invoice_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right font-extrabold text-red-500">
                        ₹{inv.outstanding_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block border rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getStatusColor(inv.status)}`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {filteredInvoices.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-muted-foreground">
                        No invoice records match the specified filters. Ingest a ledger file above to load items.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Grid properties summary */}
            <div className="flex justify-between items-center bg-muted/10 border-t border-border px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <p>Matched Items: <span className="text-foreground">{filteredInvoices.length} of {invoices.length}</span></p>
              <p>Sum Outstanding: <span className="text-red-500 font-bold text-sm">₹{filteredInvoices.reduce((sum, i) => sum + i.outstanding_amount, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></p>
            </div>

          </div>
        )}

      </div>
    </div>
    </DashboardLayout>
  );
}
