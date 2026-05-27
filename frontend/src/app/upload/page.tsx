"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { invoicesAPI } from "@/lib/api";
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Trash2, 
  Plus, 
  Check, 
  AlertTriangle, 
  ChevronLeft, 
  FileText,
  AlertCircle
} from "lucide-react";

type InvoiceRow = {
  invoice_id: string;
  customer_name: string;
  invoice_date: string;
  due_date: string;
  invoice_amount: number;
  amount_paid: number;
  status: string;
  customer_phone: string | null;
  extraction_confidence?: number;
  needs_review?: boolean;
  warnings?: string[];
};

export default function IngestPage() {
  const router = useRouter();
  
  // Navigation steps: 'upload' | 'preview'
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Grid extraction properties
  const [importSummary, setImportSummary] = useState<any>({
    file_name: "",
    file_type: "",
    file_size_bytes: 0,
    classification: "",
    extraction_method: ""
  });
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag and Drop hooks
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Perform client-side validation logic
  const validateRows = (rows: InvoiceRow[]): InvoiceRow[] => {
    const seenIds = new Map<string, number>();
    return rows.map((row, index) => {
      const warnings: string[] = [...(row.warnings || [])];
      const cleanId = row.invoice_id.trim();
      
      if (!cleanId) warnings.push("Missing invoice ID.");
      if (cleanId) {
        if (seenIds.has(cleanId)) {
          warnings.push(`Duplicate invoice ID in preview (also on row ${seenIds.get(cleanId)! + 1}).`);
        } else {
          seenIds.set(cleanId, index);
        }
      }
      if (!row.customer_name.trim()) warnings.push("Missing customer name.");
      if (row.invoice_amount < 0) warnings.push("Invoice amount cannot be negative.");
      if (row.amount_paid < 0) warnings.push("Amount paid cannot be negative.");
      if (row.amount_paid > row.invoice_amount) warnings.push("Amount paid is greater than total invoice amount.");
      
      const invDate = new Date(row.invoice_date);
      const dueDate = new Date(row.due_date);
      
      if (isNaN(invDate.getTime())) warnings.push("Invalid invoice date.");
      if (isNaN(dueDate.getTime())) warnings.push("Invalid due date.");
      if (!isNaN(invDate.getTime()) && !isNaN(dueDate.getTime()) && dueDate < invDate) {
        warnings.push("Due date is before the invoice date.");
      }

      return {
        ...row,
        warnings
      };
    });
  };

  // Submit file or text for parser extraction
  const handleExtract = async () => {
    if (!file && !pastedText.trim()) {
      setError("Please select a file to upload or paste messy invoice ledger text.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      if (file) {
        formData.append("file", file);
      } else {
        formData.append("pasted_text", pastedText);
      }

      const res = await invoicesAPI.upload(formData);
      
      // Map extracted responses
      setImportSummary({
        file_name: res.file_name,
        file_type: res.file_type,
        file_size_bytes: res.file_size_bytes,
        classification: res.classification,
        extraction_method: res.extraction_method
      });
      
      // Map to invoices array
      const mappedInvoices = res.invoices.map((inv: any) => ({
        invoice_id: inv.invoice_id,
        customer_name: inv.customer_name,
        invoice_date: String(inv.invoice_date).slice(0, 10),
        due_date: String(inv.due_date).slice(0, 10),
        invoice_amount: inv.invoice_amount,
        amount_paid: inv.amount_paid,
        status: inv.status,
        customer_phone: inv.customer_phone,
        extraction_confidence: inv.extraction_confidence,
        needs_review: inv.needs_review,
        warnings: inv.warnings || [],
      }));

      const validated = validateRows(mappedInvoices);
      setInvoices(validated);
      setStep("preview");
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 
        "Failed to extract invoice data. Please verify file format and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Grid editing operations
  const handleCellChange = (index: number, field: keyof InvoiceRow, value: any) => {
    const updated = [...invoices];
    
    if (field === "invoice_amount" || field === "amount_paid") {
      updated[index] = {
        ...updated[index],
        [field]: parseFloat(value) || 0
      };
    } else {
      updated[index] = {
        ...updated[index],
        [field]: value
      };
    }

    // Recalculate outstanding amount if changed
    const amt = updated[index].invoice_amount;
    const paid = updated[index].amount_paid;
    if (amt >= 0 && paid >= 0) {
      if (paid >= amt && amt > 0) {
        updated[index].status = "Paid";
      } else if (paid > 0) {
        updated[index].status = "Partially Paid";
      } else {
        updated[index].status = "Unpaid";
      }
    }

    // Validate rows again
    const revalidated = validateRows(updated);
    setInvoices(revalidated);
  };

  const handleAddRow = () => {
    const newRow: InvoiceRow = {
      invoice_id: `INV-${Date.now().toString().slice(-6)}`,
      customer_name: "",
      invoice_date: new Date().toISOString().split("T")[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      invoice_amount: 0,
      amount_paid: 0,
      status: "Unpaid",
      customer_phone: "",
      extraction_confidence: 1.0,
      needs_review: false,
      warnings: ["Missing customer name."]
    };
    setInvoices([...invoices, newRow]);
  };

  const handleDeleteRow = (index: number) => {
    const updated = invoices.filter((_, i) => i !== index);
    const revalidated = validateRows(updated);
    setInvoices(revalidated);
  };

  // Submit confirmed items to DB
  const handleConfirmImport = async () => {
    // Check if any critical warnings exist
    const hasWarnings = invoices.some((i) => (i.warnings || []).length > 0);
    if (hasWarnings) {
      if (!window.confirm("Some rows have validation warnings. Are you sure you want to proceed with import?")) {
        return;
      }
    }

    setError(null);
    setLoading(true);

    try {
      await invoicesAPI.confirm({
        ...importSummary,
        invoices: invoices.map(({ warnings, ...rest }) => rest)
      });
      router.push("/dashboard");
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 
        "Failed to commit invoices. Please ensure database connection is active."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
    <div className="bg-background">
            
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-border pb-6 mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Ingest Invoice Ledger
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {step === "upload" 
                ? "Upload structured invoices or paste unstructured email and whatsapp logs." 
                : "Validate extracted accounts receivable rows before committing to dashboard analytics."
              }
            </p>
          </div>
          
          {step === "upload" && (
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  if (window.confirm("Are you sure you want to delete ALL demo data (invoices, disputes, promises) from your dashboard? This cannot be undone.")) {
                    try {
                      setLoading(true);
                      await invoicesAPI.clearAll();
                      alert("Demo data cleared successfully! You can now start fresh.");
                    } catch (e) {
                      alert("Failed to clear data.");
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/20 transition-all"
              >
                <Trash2 size={16} />
                Clear Demo Data
              </button>
            </div>
          )}

          {step === "preview" && (
            <div className="flex gap-3">
              <button
                onClick={() => setStep("upload")}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-all"
              >
                <ChevronLeft size={16} />
                Back to Upload
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none transition-all"
              >
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                ) : (
                  <Check size={16} />
                )}
                Confirm Import ({invoices.length})
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive font-medium">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <h5 className="font-semibold leading-none">Error Ingestion Invoices</h5>
              <p className="mt-1 text-muted-foreground text-xs">{error}</p>
            </div>
          </div>
        )}

        {/* STEP 1: UPLOAD WIDGETS */}
        {step === "upload" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* File Drag-and-Drop Dropzone */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Structured File Upload
              </h3>
              
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={triggerFileInput}
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 cursor-pointer bg-card/40 hover:bg-card/80 transition-all min-h-[300px] text-center ${
                  dragActive ? "border-emerald-500 bg-emerald-500/5" : "border-border"
                } ${file ? "border-solid border-emerald-600 bg-emerald-600/5" : ""}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  accept=".csv,.xlsx,.xls,.txt"
                  className="hidden"
                />
                
                {file ? (
                  <div className="space-y-4">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-500">
                      {file.name.endsWith(".csv") || file.name.endsWith(".xlsx") ? (
                        <FileSpreadsheet size={32} />
                      ) : (
                        <FileText size={32} />
                      )}
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-foreground truncate max-w-xs mx-auto">
                        {file.name}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(file.size / 1024).toFixed(1)} KB — Ready for Extraction
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="text-xs font-semibold text-destructive hover:underline"
                    >
                      Remove File
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                      <UploadCloud size={32} />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-foreground">
                        Drag and drop your file here
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Supports CSV, Excel, or TXT (Max 10MB)
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                    >
                      Browse Files
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Paste Plain Ledger Text Area */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Paste Messy Text / Ledger logs
              </h3>
              
              <div className="flex flex-col min-h-[300px]">
                <textarea
                  value={pastedText}
                  onChange={(e) => {
                    setPastedText(e.target.value);
                    if (file) setFile(null); // pasted text takes precedence if typed
                  }}
                  disabled={!!file}
                  className="w-full flex-grow rounded-2xl border border-input bg-card/40 p-4 text-sm text-foreground shadow-sm placeholder:text-muted-foreground/40 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[250px] resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Example:
Customer: Mehta & Sons, Invoice ID: INV-203, dated 2026-04-10, due 2026-05-10, amount is 50000 rupees. Outstanding balance is 25000. Phone: +919900112233

Mehta & Sons also has invoice INV-204 for 75000 fully unpaid due 2026-05-20."
                />
                
                {file && (
                  <p className="text-[10px] text-emerald-500 mt-2 font-medium">
                    * Clear the file upload to paste raw text logs instead.
                  </p>
                )}
              </div>
            </div>

            {/* Ingestion triggers button */}
            <div className="lg:col-span-2 flex justify-center mt-6">
              <button
                onClick={handleExtract}
                disabled={loading || (!file && !pastedText.trim())}
                className="w-full sm:w-64 flex justify-center items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none transition-all"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                    Extracting Ledger...
                  </>
                ) : (
                  <>
                    <UploadCloud size={16} />
                    Extract Invoices
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: EDITABLE VERIFICATION PREVIEW GRID */}
        {step === "preview" && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-slate-900/5">
            
            {/* Grid properties information header */}
            <div className="flex flex-wrap items-center justify-between border-b border-border bg-muted/30 px-6 py-4 gap-3">
              <div className="flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <p>File: <span className="text-foreground normal-case">{importSummary.file_name}</span></p>
                <p>Size: <span className="text-foreground">{(importSummary.file_size_bytes / 1024).toFixed(1)} KB</span></p>
                <p>Classification: <span className="text-foreground">{importSummary.classification}</span></p>
                <p>Engine: <span className="text-emerald-500 font-bold">{importSummary.extraction_method}</span></p>
              </div>
              <button
                onClick={handleAddRow}
                className="flex items-center gap-1 text-xs font-bold text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded"
              >
                <Plus size={14} />
                Add Row
              </button>
            </div>

            {/* Spreadsheet Table Container */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/10">
                    <th className="px-4 py-3.5 w-[50px] text-center">Status</th>
                    <th className="px-4 py-3.5 w-[150px]">Invoice ID</th>
                    <th className="px-4 py-3.5 w-[220px]">Customer Name</th>
                    <th className="px-4 py-3.5 w-[140px]">Inv Date</th>
                    <th className="px-4 py-3.5 w-[140px]">Due Date</th>
                    <th className="px-4 py-3.5 w-[130px]">Amount</th>
                    <th className="px-4 py-3.5 w-[130px]">Paid</th>
                    <th className="px-4 py-3.5 w-[140px]">Phone</th>
                    <th className="px-4 py-3.5 w-[80px]">Score</th>
                    <th className="px-4 py-3.5">Warnings</th>
                    <th className="px-4 py-3.5 w-[60px] text-center">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {invoices.map((inv, idx) => (
                    <tr key={idx} className="hover:bg-muted/10 transition-colors">
                      
                      {/* Check column warnings icon */}
                      <td className="px-4 py-2.5 text-center">
                        {inv.needs_review ? (
                          <div className="flex justify-center text-red-500" title="Needs Review!">
                            <AlertCircle size={18} />
                          </div>
                        ) : inv.warnings && inv.warnings.length > 0 ? (
                          <div className="flex justify-center text-yellow-500" title="Validation Alert!">
                            <AlertTriangle size={18} />
                          </div>
                        ) : (
                          <div className="flex justify-center text-emerald-500">
                            <Check size={18} />
                          </div>
                        )}
                      </td>

                      {/* Invoice ID input */}
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={inv.invoice_id}
                          onChange={(e) => handleCellChange(idx, "invoice_id", e.target.value)}
                          className="w-full border-0 bg-transparent px-2 py-1 focus:ring-1 focus:ring-emerald-500 rounded focus:bg-background border-dashed border border-border"
                        />
                      </td>

                      {/* Customer name input */}
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={inv.customer_name}
                          onChange={(e) => handleCellChange(idx, "customer_name", e.target.value)}
                          className="w-full border-0 bg-transparent px-2 py-1 focus:ring-1 focus:ring-emerald-500 rounded focus:bg-background border-dashed border border-border"
                        />
                      </td>

                      {/* Invoice Date input */}
                      <td className="px-2 py-1.5">
                        <input
                          type="date"
                          value={inv.invoice_date}
                          onChange={(e) => handleCellChange(idx, "invoice_date", e.target.value)}
                          className="w-full border-0 bg-transparent px-2 py-1 focus:ring-1 focus:ring-emerald-500 rounded focus:bg-background border-dashed border border-border text-xs"
                        />
                      </td>

                      {/* Due Date input */}
                      <td className="px-2 py-1.5">
                        <input
                          type="date"
                          value={inv.due_date}
                          onChange={(e) => handleCellChange(idx, "due_date", e.target.value)}
                          className="w-full border-0 bg-transparent px-2 py-1 focus:ring-1 focus:ring-emerald-500 rounded focus:bg-background border-dashed border border-border text-xs"
                        />
                      </td>

                      {/* Total invoice amount input */}
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          value={inv.invoice_amount}
                          onChange={(e) => handleCellChange(idx, "invoice_amount", e.target.value)}
                          className="w-full border-0 bg-transparent px-2 py-1 focus:ring-1 focus:ring-emerald-500 rounded focus:bg-background border-dashed border border-border font-medium text-right pr-4"
                        />
                      </td>

                      {/* Paid amount input */}
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          value={inv.amount_paid}
                          onChange={(e) => handleCellChange(idx, "amount_paid", e.target.value)}
                          className="w-full border-0 bg-transparent px-2 py-1 focus:ring-1 focus:ring-emerald-500 rounded focus:bg-background border-dashed border border-border font-medium text-right pr-4"
                        />
                      </td>

                      {/* Phone input */}
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={inv.customer_phone || ""}
                          onChange={(e) => handleCellChange(idx, "customer_phone", e.target.value || null)}
                          className="w-full border-0 bg-transparent px-2 py-1 focus:ring-1 focus:ring-emerald-500 rounded focus:bg-background border-dashed border border-border"
                          placeholder="+91..."
                        />
                      </td>

                      {/* Score gauge */}
                      <td className="px-2 py-1.5 text-center">
                        {inv.extraction_confidence !== undefined ? (
                          <div className="flex flex-col items-center justify-center">
                            <div className={`px-2 py-0.5 rounded text-xs font-bold ${
                              inv.extraction_confidence >= 0.95 ? "bg-emerald-500/10 text-emerald-600" :
                              inv.extraction_confidence >= 0.75 ? "bg-yellow-500/10 text-yellow-600" :
                              "bg-red-500/10 text-red-600"
                            }`}>
                              {(inv.extraction_confidence * 100).toFixed(0)}%
                            </div>
                            {inv.needs_review && (
                              <span className="text-[9px] font-bold text-red-600 uppercase mt-0.5 leading-none">Review</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Warning tags */}
                      <td className="px-4 py-2.5 max-w-[200px] truncate">
                        {inv.warnings && inv.warnings.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {inv.warnings.map((warn, wIdx) => (
                              <span key={wIdx} className="text-[10px] font-semibold text-yellow-500 leading-none">
                                • {warn}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] font-medium text-muted-foreground">Clean data</span>
                        )}
                      </td>

                      {/* Delete actions */}
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => handleDeleteRow(idx)}
                          className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>

                    </tr>
                  ))}
                  
                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center py-8 text-muted-foreground">
                        Spreadsheet is empty. Click &quot;Add Row&quot; above to manually create invoice receivables.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Quick summary calculations */}
            <div className="flex justify-end bg-muted/10 border-t border-border px-6 py-4">
              <div className="text-right space-y-1">
                <p className="text-xs text-muted-foreground">Total Extracted Items: <span className="font-bold text-foreground">{invoices.length}</span></p>
                <p className="text-xs text-muted-foreground">Needs Review: <span className="font-bold text-red-500">{invoices.filter(i => i.needs_review).length}</span></p>
                <p className="text-xs text-muted-foreground">Cumulative Outstanding Invoices: <span className="font-bold text-emerald-500">₹{invoices.reduce((sum, inv) => sum + Math.max(inv.invoice_amount - inv.amount_paid, 0), 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
    </DashboardLayout>
  );
}
