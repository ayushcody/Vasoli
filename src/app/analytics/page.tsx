"use client";

import React, { useEffect, useState } from "react";
import WealthCubeWrapper from "@/client/components/analytics/WealthCube";
import { userClient } from "@/client/lib/api";

export default function AnalyticsPage() {
    const [data, setData] = useState({ saved: 0, spent: 0, invested: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadAnalytics() {
            try {
                const response = await userClient.getWealthAnalytics({});
                setData({
                    saved: response.saved,
                    spent: response.spent,
                    invested: response.invested,
                });
            } catch (error) {
                console.error("Failed to load wealth analytics via gRPC", error);
            } finally {
                setLoading(false);
            }
        }
        loadAnalytics();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    const total = data.saved + data.spent + data.invested;
    const investedPercent = total > 0 ? Math.round((data.invested / total) * 100) : 0;
    const savedPercent = total > 0 ? Math.round((data.saved / total) * 100) : 0;
    const spentPercent = total > 0 ? Math.round((data.spent / total) * 100) : 0;

    return (
        <div className="min-h-screen bg-black text-white p-8 font-sans">
            <div className="max-w-5xl mx-auto space-y-8">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight mb-2">Wealth Analytics</h1>
                    <p className="text-slate-400">Interactive 3D overview of your financial health, streamed live via gRPC.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
                            The Wealth Cube
                        </h2>
                        <div className="p-1 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl">
                            <WealthCubeWrapper saved={data.saved} spent={data.spent} invested={data.invested} />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                            <h3 className="text-lg font-bold mb-4 text-slate-300">Quick Stats</h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-slate-400">Invested</span>
                                        <span className="font-mono text-blue-400">₹{data.invested.toLocaleString()}</span>
                                    </div>
                                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${investedPercent}%` }}></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-slate-400">Saved</span>
                                        <span className="font-mono text-green-400">₹{data.saved.toLocaleString()}</span>
                                    </div>
                                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500 transition-all duration-1000" style={{ width: `${savedPercent}%` }}></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-slate-400">Spent (YTD)</span>
                                        <span className="font-mono text-red-400">₹{data.spent.toLocaleString()}</span>
                                    </div>
                                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${spentPercent}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border border-indigo-500/30 rounded-xl p-6">
                            <h3 className="text-indigo-300 font-bold mb-2">Smart Insight</h3>
                            <p className="text-sm text-slate-300 leading-relaxed">
                                Your investment ratio is <span className="text-white font-bold">{investedPercent}%</span> of your total wealth. You are on track to max out your Section 80C deductions well before March 31st!
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
