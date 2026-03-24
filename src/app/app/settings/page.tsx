"use client";

import { useState } from "react";
import { StatementImporter } from "@/components/import/statement-importer";
import { motion } from "framer-motion";
import {
    Smartphone, Shield, Tag, RotateCcw, Loader2, Sparkles,
    CheckCircle2, Key, Zap
} from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
    const [gpayKey, setGpayKey] = useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("vasoli_gpay_api_key") || "";
        }
        return "";
    });
    const [seeding, setSeeding] = useState(false);
    const [seeded, setSeeded] = useState(false);

    const saveGpayKey = () => {
        localStorage.setItem("vasoli_gpay_api_key", gpayKey);
        toast.success("Google Pay API key saved locally");
    };

    const handleDemoSeed = async () => {
        toast.info("Demo seeding is currently disabled in gRPC mode.");
    };

    const sections = [
        { delay: 0.1 },
        { delay: 0.2 },
        { delay: 0.3 },
        { delay: 0.4 },
        { delay: 0.5 },
    ];

    return (
        <div className="p-8 max-w-4xl">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="font-serif text-3xl font-bold text-ink mb-2">Settings</h1>
                <p className="text-taupe mb-8">Manage imports, integrations, vault, and preferences.</p>
            </motion.div>

            <div className="space-y-8">
                {/* Statement Import */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: sections[0].delay }}
                    className="border-brutal-thick rounded-neo-md bg-paper-2 p-6 shadow-brutal"
                >
                    <h2 className="font-serif text-xl font-bold text-ink mb-1 flex items-center gap-2">
                        📥 Statement Import
                    </h2>
                    <p className="text-taupe text-sm mb-5">
                        Upload your bank statement CSV to auto-create transactions with provenance tracking.
                    </p>
                    <StatementImporter />
                </motion.div>

                {/* API Integrations */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: sections[1].delay }}
                    className="border-brutal-thick rounded-neo-md bg-paper-2 p-6 shadow-brutal"
                >
                    <h2 className="font-serif text-xl font-bold text-ink mb-1 flex items-center gap-2">
                        <Smartphone size={20} /> API Integrations
                    </h2>
                    <p className="text-taupe text-sm mb-5">
                        Connect external payment APIs. Keys are stored securely in your browser's local storage.
                    </p>

                    <div className="space-y-4">
                        {/* Google Pay API Key */}
                        <div className="border-brutal rounded-neo bg-paper-1 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Key size={14} className="text-cobalt" />
                                <span className="text-sm font-medium text-ink">Google Pay API Key</span>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    value={gpayKey}
                                    onChange={(e) => setGpayKey(e.target.value)}
                                    placeholder="Enter your Google Pay API key"
                                    className="flex-1 border-brutal rounded-neo px-4 py-2.5 bg-paper-2 text-ink text-sm placeholder:text-taupe focus:outline-none focus:ring-2 focus:ring-ink"
                                />
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={saveGpayKey}
                                    className="border-brutal rounded-neo bg-cta text-ink px-4 py-2.5 text-sm font-semibold shadow-brutal-sm hover:shadow-brutal transition-all"
                                >
                                    Save
                                </motion.button>
                            </div>
                            <p className="text-xs text-taupe mt-2">
                                Used for UPI payment initiation. Never sent to our servers.
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Receipt Vault */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: sections[2].delay }}
                    className="border-brutal-thick rounded-neo-md bg-paper-2 p-6 shadow-brutal"
                >
                    <h2 className="font-serif text-xl font-bold text-ink mb-1 flex items-center gap-2">
                        <Shield size={20} /> Receipt Vault
                    </h2>
                    <p className="text-taupe text-sm">
                        Set or change your vault passphrase for encrypted receipt storage. Encryption uses AES-256-GCM and runs entirely in your browser.
                    </p>
                </motion.div>

                {/* Categories */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: sections[3].delay }}
                    className="border-brutal-thick rounded-neo-md bg-paper-2 p-6 shadow-brutal"
                >
                    <h2 className="font-serif text-xl font-bold text-ink mb-1 flex items-center gap-2">
                        <Tag size={20} /> Categories
                    </h2>
                    <p className="text-taupe text-sm">
                        Manage spending categories for better tracking. Default Indian categories are pre-loaded.
                    </p>
                </motion.div>

                {/* Developer / Demo Mode */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: sections[4].delay }}
                    className="border-brutal-thick rounded-neo-md bg-paper-2 p-6 shadow-brutal border-grape/30"
                >
                    <h2 className="font-serif text-xl font-bold text-ink mb-1 flex items-center gap-2">
                        <Zap size={20} className="text-grape" /> Developer Mode
                    </h2>
                    <p className="text-taupe text-sm mb-5">
                        Load your account with realistic demo data to explore all features of Vasoli instantly.
                    </p>

                    <div className="border-brutal rounded-neo bg-grape/5 p-4">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div>
                                <h3 className="text-sm font-medium text-ink mb-1 flex items-center gap-2">
                                    <Sparkles size={14} className="text-grape" />
                                    Enable Demo Mode
                                </h3>
                                <p className="text-xs text-taupe">
                                    Adds 30 transactions, 4 goals, and 3 receipts with Indian financial data.
                                </p>
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleDemoSeed}
                                disabled={seeding || seeded}
                                className={`border-brutal-thick rounded-neo px-5 py-2.5 text-sm font-semibold flex items-center gap-2 shadow-brutal-sm transition-all ${seeded
                                    ? "bg-success/20 text-success border-success/30"
                                    : "bg-grape text-paper-1 hover:shadow-brutal"
                                    } disabled:opacity-60`}
                            >
                                {seeding ? (
                                    <><Loader2 size={16} className="animate-spin" /> Seeding...</>
                                ) : seeded ? (
                                    <><CheckCircle2 size={16} /> Demo Loaded!</>
                                ) : (
                                    <><Sparkles size={16} /> Load Demo Data</>
                                )}
                            </motion.button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
