"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X } from "lucide-react";
import { importClient } from "@/lib/rpc/clients";
import { track } from "@/lib/analytics";

interface ImportResultData {
    batchId: string;
    parsedCount: number;
    createdCount: number;
    matchedCount: number;
}

export function StatementImporter() {
    const [file, setFile] = useState<File | null>(null);
    const [format, setFormat] = useState<"hdfc" | "generic">("hdfc");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ImportResultData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImport = async () => {
        if (!file) return;
        setLoading(false); // Reset but we'll set it in the reader
        setError(null);
        setResult(null);

        const reader = new FileReader();
        reader.onload = async (e) => {
            const data = e.target?.result;
            if (!(data instanceof ArrayBuffer)) return;

            setLoading(true);
            try {
                const res = await importClient.importStatement({
                    file: new Uint8Array(data),
                    format: format,
                });

                setResult({
                    batchId: res.batchId,
                    parsedCount: res.parsedCount,
                    createdCount: res.createdCount,
                    matchedCount: res.matchedCount,
                });
                track("statement_imported", {
                    format,
                    createdCount: res.createdCount,
                    parsedCount: res.parsedCount,
                });
            } catch (err: any) {
                console.error("Import error:", err);
                setError(err.message || "Import failed");
            } finally {
                setLoading(false);
            }
        };
        reader.onerror = () => setError("Failed to read file");
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="space-y-5">
            {/* Format selector */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-ink">Bank Format</label>
                <div className="flex gap-3">
                    {[
                        { value: "hdfc" as const, label: "HDFC Bank" },
                        { value: "generic" as const, label: "Generic CSV" },
                    ].map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setFormat(opt.value)}
                            className={`border-brutal rounded-neo px-4 py-2 text-sm font-medium transition-all ${format === opt.value
                                ? "bg-mustard text-ink shadow-brutal-sm"
                                : "bg-paper-1 text-taupe hover:bg-paper-2"
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* File drop zone */}
            <div
                onClick={() => fileInputRef.current?.click()}
                className="border-brutal-thick border-dashed rounded-neo-md bg-paper-1 p-8 text-center cursor-pointer hover:bg-paper-2/50 transition-colors"
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setFile(f);
                    }}
                />
                {file ? (
                    <div className="flex items-center justify-center gap-3">
                        <FileText className="text-cobalt" size={20} />
                        <span className="text-sm font-medium text-ink">{file.name}</span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setFile(null);
                            }}
                            className="text-taupe hover:text-danger"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ) : (
                    <div>
                        <Upload className="mx-auto mb-2 text-taupe" size={28} />
                        <p className="text-sm text-taupe">Click to upload a CSV statement</p>
                    </div>
                )}
            </div>

            {/* Import button */}
            <motion.button
                onClick={handleImport}
                disabled={!file || loading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-2 border-brutal-thick rounded-neo bg-cta text-ink font-semibold py-3 shadow-brutal-sm hover:shadow-brutal transition-all disabled:opacity-40"
            >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                {loading ? "Importing..." : "Import Statement"}
            </motion.button>

            {/* Results */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-brutal rounded-neo bg-red-50 p-4 flex items-start gap-3"
                    >
                        <AlertCircle className="text-danger flex-shrink-0 mt-0.5" size={18} />
                        <p className="text-sm text-danger">{error}</p>
                    </motion.div>
                )}

                {result && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-brutal rounded-neo bg-teal/10 p-4 space-y-2"
                    >
                        <div className="flex items-center gap-2 text-success font-medium">
                            <CheckCircle size={18} />
                            Import Complete
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="border-brutal rounded-neo bg-paper-1 p-3">
                                <div className="text-xl font-bold font-serif text-ink">{result.parsedCount}</div>
                                <div className="text-xs text-taupe">Parsed</div>
                            </div>
                            <div className="border-brutal rounded-neo bg-paper-1 p-3">
                                <div className="text-xl font-bold font-serif text-ink">{result.createdCount}</div>
                                <div className="text-xs text-taupe">Created</div>
                            </div>
                            <div className="border-brutal rounded-neo bg-paper-1 p-3">
                                <div className="text-xl font-bold font-serif text-ink">{result.matchedCount}</div>
                                <div className="text-xs text-taupe">Matched</div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
