"use client";

import React, { useState } from "react";
import { parseBankSMS, ParsedSMS } from "@/client/lib/smsParser";
import { transactionClient } from "@/client/lib/api";

const SAMPLE_SMS = [
    "Rs.500.00 has been debited from a/c **1234 on 28-02-26 to VPA foo@bar. UPI Ref 12345.",
    "UPDATE: INR 1,500.00 debited from HDFC Bank A/c xx1234 on 28-Feb-26. Info: Swiggy. Avl Bal: INR 10,000.00.",
    "Dear SBI User, your A/c X1234-debited by Rs100.00 on 28Feb26. Ref No 1234",
    "Acct XX1234 debited with INR 500.00 on 28-Feb-26. Info: Amazon."
];

export default function SmsSimulator() {
    const [inputText, setInputText] = useState("");
    const [parsedData, setParsedData] = useState<ParsedSMS | null>(null);
    const [syncStatus, setSyncStatus] = useState<"IDLE" | "SYNCING" | "SUCCESS" | "ERROR">("IDLE");

    const handleParse = (text: string) => {
        setInputText(text);
        const result = parseBankSMS(text);
        setParsedData(result);
        setSyncStatus("IDLE");
    };

    const handleSyncToBackend = async () => {
        if (!parsedData) return;
        setSyncStatus("SYNCING");
        try {
            // Send the parsed data to the Go gRPC backend using the new UPI fields
            await transactionClient.createTransaction({
                amount: parsedData.amount,
                type: parsedData.type,
                description: parsedData.merchant || `SMS Import from ${parsedData.bank || 'Bank'}`,
                // Mapping our new UPI models
                paymentMethod: parsedData.bank === "UPI Generic" ? "UPI" : "BANK_TRANSFER",
                date: { seconds: BigInt(Math.floor(Date.now() / 1000)), nanos: 0 } as any,
            });
            setSyncStatus("SUCCESS");
        } catch (e) {
            console.error(e);
            setSyncStatus("ERROR");
        }
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white max-w-2xl w-full">
            <h3 className="text-xl font-bold mb-2">Device SMS Auto-Sync Simulator</h3>
            <p className="text-slate-400 text-sm mb-6">
                Simulate the React Native device-layer intercepting an incoming SMS. The regex engine parses the transaction details and queues it for the Go backend.
            </p>

            <div className="space-y-4 mb-6">
                <label className="block text-sm font-medium text-slate-300">Test with sample SMS payloads:</label>
                <div className="flex flex-wrap gap-2">
                    {SAMPLE_SMS.map((sms, i) => (
                        <button
                            key={i}
                            onClick={() => handleParse(sms)}
                            className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded border border-slate-700 transition"
                        >
                            Sample {i + 1}
                        </button>
                    ))}
                </div>
            </div>

            <textarea
                value={inputText}
                onChange={(e) => handleParse(e.target.value)}
                placeholder="Paste a bank SMS here..."
                className="w-full h-24 bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none mb-6 font-mono"
            />

            {parsedData && (
                <div className="bg-slate-800 rounded-lg p-4 mb-6 border border-slate-700">
                    <h4 className="font-bold text-green-400 mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Successfully Parsed
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-slate-400 block text-xs">Bank Model</span>
                            <span className="font-mono">{parsedData.bank || "Unknown"}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block text-xs">Amount</span>
                            <span className="font-mono text-lg font-bold">₹{parsedData.amount.toLocaleString()}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block text-xs">Type</span>
                            <span className={`font-mono font-bold ${parsedData.type === 'CREDIT' ? 'text-green-400' : 'text-red-400'}`}>
                                {parsedData.type}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-400 block text-xs">Merchant / Ref</span>
                            <span className="font-mono">{parsedData.merchant || "N/A"}</span>
                        </div>
                    </div>
                </div>
            )}

            {parsedData && (
                <button
                    onClick={handleSyncToBackend}
                    disabled={syncStatus === "SYNCING" || syncStatus === "SUCCESS"}
                    className={`w-full py-3 rounded-lg font-bold flex justify-center items-center transition ${syncStatus === "SUCCESS" ? "bg-green-600 text-white" :
                            syncStatus === "ERROR" ? "bg-red-600 text-white" :
                                "bg-blue-600 hover:bg-blue-700 text-white"
                        }`}
                >
                    {syncStatus === "SUCCESS" ? "Synced to Go Backend!" :
                        syncStatus === "SYNCING" ? "Syncing via gRPC..." :
                            syncStatus === "ERROR" ? "Sync Failed" :
                                "Sync Parsed Transaction to DB"}
                </button>
            )}
        </div>
    );
}
