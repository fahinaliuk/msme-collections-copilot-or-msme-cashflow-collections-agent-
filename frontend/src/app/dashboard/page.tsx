"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { dashboardAPI } from "@/lib/api";
import { motion } from "framer-motion";
import {
  IndianRupee,
  Clock,
  TrendingDown,
  Calendar,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  FileSpreadsheet,
  Building,
  Handshake,
  ShieldAlert
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend
} from "recharts";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dashboard state aggregates
  const [summary, setSummary] = useState<any | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const fetchSummary = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await dashboardAPI.getSummary();
        setSummary(data);
      } catch (err: any) {
        setError("Failed to fetch dashboard data. Please ensure the backend is running.");
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
      <div className="bg-background">
                <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
            <p className="text-sm text-muted-foreground">Compiling collections intelligence...</p>
          </div>
        </div>
      </div>
      </DashboardLayout>
    );
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "critical": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "high": return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "medium": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default: return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid": return "bg-emerald-500/10 text-emerald-500";
      case "partially paid": return "bg-yellow-500/10 text-yellow-500";
      default: return "bg-red-500/10 text-red-500";
    }
  };

  const kpiData = [
    {
      title: "Total Receivables",
      value: `₹${summary?.kpis.total_receivables.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
      subtitle: "Unpaid outstanding amount",
      icon: IndianRupee,
      color: "text-blue-500 bg-blue-500/10"
    },
    {
      title: "Overdue Receivables",
      value: `₹${summary?.kpis.overdue_invoices_amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
      subtitle: `${summary?.kpis.overdue_invoices_count} unpaid invoices overdue`,
      icon: Clock,
      color: "text-red-500 bg-red-500/10"
    },
    {
      title: "Total Collected",
      value: `₹${summary?.kpis.collected_amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
      subtitle: "Amount successfully received",
      icon: TrendingUp,
      color: "text-emerald-500 bg-emerald-500/10"
    },
    {
      title: "Overdue Percentage",
      value: `${summary?.kpis.overdue_percentage.toFixed(1)}%`,
      subtitle: "Ratio of overdue to total",
      icon: TrendingDown,
      color: "text-yellow-500 bg-yellow-500/10"
    }
  ];

  return (
    <DashboardLayout>
    <div className="bg-background">
            
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-border pb-6 mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Executive Dashboard
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Real-time accounts receivable overview, aging breakdown, and collections priority pipelines.
            </p>
          </div>
          <Link
            href="/upload"
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 hover:shadow-emerald-600/30 transition-all shrink-0"
          >
            <ArrowUpRight size={16} />
            Ingest Ledger File
          </Link>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive font-medium">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* 1. KPI CARDS SECTION */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {kpiData.map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                whileHover={{ y: -4, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)" }}
                className="glow-card bg-card border border-border rounded-2xl p-6 shadow-md shadow-slate-900/5 relative overflow-hidden"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{kpi.title}</p>
                    <h3 className="text-2xl font-extrabold text-foreground tracking-tight">{kpi.value}</h3>
                    <p className="text-xs text-muted-foreground">{kpi.subtitle}</p>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.color}`}>
                    <Icon size={20} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* 1.5 PROMISE & DISPUTE WIDGETS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 400 }}>
            <Link href="/promises" className="block border border-border bg-card rounded-2xl p-5 shadow-md hover:border-emerald-500/30 transition-all">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Broken Promises</p>
                <p className="text-2xl font-extrabold text-red-500">{summary?.broken_promises_count ?? "—"}</p>
                <p className="text-[10px] text-muted-foreground">View promise-to-pay tracker</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                <Handshake size={20} />
              </div>
            </div>
          </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 400 }}>
          <Link href="/disputes" className="block border border-border bg-card rounded-2xl p-5 shadow-md hover:border-emerald-500/30 transition-all">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Open Disputes</p>
                <p className="text-2xl font-extrabold text-orange-500">{summary?.open_disputes_count ?? "—"}</p>
                <p className="text-[10px] text-muted-foreground">View dispute management</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
                <ShieldAlert size={20} />
              </div>
            </div>
          </Link>
          </motion.div>
        </div>

        {/* 2. CHARTS SECTION (GRID) */}
        {mounted && summary && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            
            {/* Aging Bucket Chart (1/3 columns) */}
            <div className="border border-border bg-card rounded-2xl p-6 shadow-md">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                Aging Bucket Distribution
              </h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.aging_buckets} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="bucket" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(val) => `₹${val/1000}k`} tickLine={false} />
                    <Tooltip 
                      formatter={(val: any) => [`₹${val.toLocaleString()}`, "Outstanding"]}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "10px" }}
                    />
                    <Bar dataKey="amount" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Overdue historic trend (2/3 columns) */}
            <div className="border border-border bg-card rounded-2xl p-6 shadow-md lg:col-span-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                Outstanding Overdue historic Trend
              </h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={summary.overdue_trends} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(val) => `₹${val/1000}k`} tickLine={false} />
                    <Tooltip 
                      formatter={(val: any) => [`₹${val.toLocaleString()}`, "Overdue Amount"]}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "10px" }}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorTrend)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Collections summary (collected vs outstanding by month) */}
            <div className="border border-border bg-card rounded-2xl p-6 shadow-md lg:col-span-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
                Collections Summary
              </h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.collections_summary} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(val) => `₹${val/1000}k`} tickLine={false} />
                    <Tooltip
                      formatter={(val: number) => [`₹${Number(val).toLocaleString()}`, ""]}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "10px" }}
                    />
                    <Legend />
                    <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="outstanding" name="Outstanding" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}

        {/* 3. PRIORITY PIPELINE & RECENT INVOICES */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Top collections Priorities (5/12 columns) */}
          <div className="lg:col-span-5 border border-border bg-card rounded-2xl p-6 shadow-md flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Collections priorities
                </h3>
                <Link href="/collections" className="text-xs font-semibold text-emerald-500 hover:underline">
                  Open Engine
                </Link>
              </div>

              <div className="space-y-4">
                {summary?.top_priorities.slice(0, 4).map((p: any) => (
                  <div key={p.customer_name} className="flex items-center justify-between border-b border-border/40 pb-3 last:border-b-0 last:pb-0">
                    <div className="space-y-0.5 truncate">
                      <h4 className="font-semibold text-sm text-foreground truncate">{p.customer_name}</h4>
                      <span className={`inline-block text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-semibold leading-none ${getTierColor(p.risk_tier)}`}>
                        {p.risk_tier} risk
                      </span>
                    </div>
                    
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">₹{p.total_outstanding.toLocaleString("en-IN")}</p>
                      <p className="text-[10px] text-muted-foreground font-medium">{p.max_overdue_days} days overdue</p>
                    </div>
                  </div>
                ))}

                {(!summary?.top_priorities || summary.top_priorities.length === 0) && (
                  <p className="text-center py-8 text-xs text-muted-foreground">No accounts receivable priorities. Good job!</p>
                )}
              </div>
            </div>

            {summary?.top_priorities.length > 0 && (
              <Link
                href="/collections"
                className="mt-6 flex w-full justify-center items-center gap-1.5 rounded-lg border border-border bg-muted/40 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-all"
              >
                Draft WhatsApp Reminders
                <ArrowUpRight size={14} />
              </Link>
            )}
          </div>

          {/* Recent invoices list (7/12 columns) */}
          <div className="lg:col-span-7 border border-border bg-card rounded-2xl p-6 shadow-md">
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Recent Ingested Invoices
              </h3>
              <Link href="/invoices" className="text-xs font-semibold text-emerald-500 hover:underline">
                View All
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                    <th className="pb-2 w-[100px]">Invoice ID</th>
                    <th className="pb-2">Customer</th>
                    <th className="pb-2 text-right">Outstanding</th>
                    <th className="pb-2 text-center w-[100px]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {summary?.recent_invoices.map((inv: any) => (
                    <tr key={inv.invoice_id} className="hover:bg-muted/10">
                      <td className="py-2.5 font-mono text-foreground font-semibold">{inv.invoice_id}</td>
                      <td className="py-2.5 font-medium truncate max-w-[150px]">{inv.customer_name}</td>
                      <td className="py-2.5 text-right font-bold text-foreground">₹{inv.outstanding_amount.toLocaleString("en-IN")}</td>
                      <td className="py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-semibold text-[9px] ${getStatusColor(inv.status)}`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {(!summary?.recent_invoices || summary.recent_invoices.length === 0) && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-muted-foreground">No recent invoices found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </div>
    </DashboardLayout>
  );
}
