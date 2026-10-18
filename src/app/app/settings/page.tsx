"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Shield, Wallet } from "lucide-react";
import { AccountsManager } from "@/components/app/accounts-manager";
import { AccountLifecycleControls } from "@/components/app/account-lifecycle-controls";

export default function SettingsPage() {
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
                <p className="text-taupe mb-8">Manage accounts and review notification and connection status.</p>
            </motion.div>

            <div className="space-y-8">
                {/* Net Worth & Accounts */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: sections[0].delay }}
                    className="border-brutal-thick rounded-neo-md bg-paper-2 p-6 shadow-brutal"
                >
                    <h2 className="font-serif text-xl font-bold text-ink mb-1 flex items-center gap-2">
                        <Wallet size={20} /> Net Worth & Accounts
                    </h2>
                    <p className="text-taupe text-sm mb-5">
                        Track your assets, bank accounts, and liabilities to calculate your true net worth.
                    </p>
                    <AccountsManager />
                </motion.div>

                <AccountLifecycleControls />

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
                        Unlock encrypted receipt previews in the <Link href="/app/receipts" className="font-semibold underline underline-offset-4">Receipt Vault</Link>. Encryption uses AES-256-GCM and runs entirely in your browser.
                    </p>
                </motion.div>

                {/* Notifications */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: sections[3].delay }}
                    className="border-brutal-thick rounded-neo-md bg-paper-2 p-6 shadow-brutal"
                >
                    <h2 className="font-serif text-xl font-bold text-ink mb-1 flex items-center gap-2">
                        🔔 Notifications
                    </h2>
                    <p className="text-taupe text-sm mb-5">
                        Review which reminder channels are available for this workspace.
                    </p>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-brutal rounded-neo bg-paper-1 p-4">
                            <div>
                                <h3 className="text-sm font-medium text-ink mb-1">In-App Alerts</h3>
                                <p className="text-xs text-taupe">Show badges and alerts inside Vasoli</p>
                            </div>
                            <div className="text-sm text-taupe">Enabled by default</div>
                        </div>

                        <div className="flex items-center justify-between border-brutal rounded-neo bg-paper-1 p-4">
                            <div>
                                <h3 className="text-sm font-medium text-ink mb-1">Email Reminders</h3>
                                <p className="text-xs text-taupe">Receive a daily digest of due items</p>
                            </div>
                            <div className="text-sm text-taupe">{process.env.NEXT_PUBLIC_ENABLE_EMAIL_NOTIFICATIONS === 'true' ? 'Configured' : 'Disabled in environment'}</div>
                        </div>

                        <div className="flex items-center justify-between border-brutal rounded-neo bg-paper-1 p-4 opacity-50">
                            <div>
                                <h3 className="text-sm font-medium text-ink mb-1">Push Notifications</h3>
                                <p className="text-xs text-taupe">Mobile push alerts (Coming soon)</p>
                            </div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-taupe bg-paper-2 px-2 py-1 rounded border-brutal border-taupe/30">Coming Soon</div>
                        </div>
                    </div>
                </motion.div>

                {/* External Integrations Placeholder */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: sections[3].delay + 0.1 }}
                    className="border-brutal-thick rounded-neo-md bg-paper-2 p-6 shadow-brutal"
                >
                    <h2 className="font-serif text-xl font-bold text-ink mb-1 flex items-center gap-2">
                        🔗 Connected Accounts
                    </h2>
                    <p className="text-taupe text-sm mb-5">
                        Live bank integrations and broker sync via the Account Aggregator framework are currently in development.
                    </p>

                    <div className="bg-alert-yellow/20 border-brutal border-alert-yellow rounded-neo p-4 mb-4 text-sm text-ink flex items-start gap-3">
                        <div className="mt-0.5 text-alert-yellow">🔒</div>
                        <div>
                            <strong>Privacy-First Guarantee:</strong> When released, Vasoli will use explicit, time-bound consent to request read-only data. We will never sell your data or request your bank passwords.
                        </div>
                    </div>

                    <div className="flex items-center justify-between border-brutal rounded-neo bg-paper-1 p-4 opacity-50">
                        <div>
                            <h3 className="text-sm font-medium text-ink mb-1">India Account Aggregator (AA)</h3>
                            <p className="text-xs text-taupe">Auto-sync transactions and balances safely</p>
                        </div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-taupe bg-paper-2 px-2 py-1 rounded border-brutal border-taupe/30">Coming Soon</div>
                    </div>
                </motion.div>

            </div>
        </div>
    );
}
