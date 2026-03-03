import React from "react";
import SmsSimulator from "@/client/components/SmsSimulator";

export default function SmsImportPage() {
    return (
        <div className="min-h-screen bg-black text-white p-8 font-sans">
            <div className="max-w-4xl mx-auto space-y-8">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight mb-2">Automated SMS Import</h1>
                    <p className="text-slate-400">Vasoli uses strictly localized, on-device parsing to log your transactions without bank integrations.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold">Try the Simulator</h2>
                        <SmsSimulator />
                    </div>

                    <div className="space-y-6 text-slate-300">
                        <h3 className="text-lg font-bold text-white">How Vasoli Syncs Your Data</h3>
                        <ul className="list-disc pl-5 space-y-4">
                            <li>
                                <strong className="text-blue-400">Privacy First:</strong> The Vasoli React Native app requests SMS read permissions strictly limited to verified banking and financial sender IDs.
                            </li>
                            <li>
                                <strong className="text-green-400">On-Device Parsing:</strong> Your messages never leave the device. A robust regex engine extracts the amount, merchant, and UPI reference locally on your phone.
                            </li>
                            <li>
                                <strong className="text-purple-400">Encrypted Transport:</strong> Only the structured transaction data (e.g. `$50 to Amazon`) is pushed to the Go generic backend using our secure Connect-RPC channels.
                            </li>
                        </ul>

                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mt-8">
                            <h4 className="font-bold mb-2">Supported Formats In This Build</h4>
                            <div className="flex flex-wrap gap-2 text-xs font-mono">
                                <span className="bg-blue-900/50 text-blue-300 px-2 py-1 rounded">HDFC</span>
                                <span className="bg-blue-900/50 text-blue-300 px-2 py-1 rounded">SBI</span>
                                <span className="bg-blue-900/50 text-blue-300 px-2 py-1 rounded">ICICI</span>
                                <span className="bg-purple-900/50 text-purple-300 px-2 py-1 rounded">Generic UPI</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
