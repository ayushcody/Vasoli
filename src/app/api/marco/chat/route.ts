import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { getGenAI, verifyMarcoModel, MARCO_MODEL, MARCO_TOOL_DECLARATIONS } from "@/lib/marco/gemini";
import { MARCO_SYSTEM_PROMPT } from "@/lib/marco/system-prompt";
import { executeTool, type ToolName } from "@/lib/marco/tools";
import { logError } from "@/lib/logger";
import { Content, Part, FunctionCall } from "@google/genai";

export async function POST(req: NextRequest) {
    try {
        const supabase = createClient();
        const [{ data: { user } }, { data: { session } }] = await Promise.all([
            supabase.auth.getUser(),
            supabase.auth.getSession(),
        ]);
        if (!user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        try {
            await verifyMarcoModel();
        } catch {
            return Response.json({ error: "Marco is unavailable. Your records and payday plan still work. A supported model must be configured to enable chat." }, { status: 503 });
        }

        const body = await req.json();
        const { threadId, message } = body;

        if (!threadId || !message) {
            return new Response(
                JSON.stringify({ error: "threadId and message are required" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Verify thread ownership
        const { data: thread, error: threadError } = await supabase
            .from("marco_threads")
            .select("*")
            .eq("id", threadId)
            .eq("userId", user.id)
            .single();

        if (threadError || !thread) {
            return new Response(JSON.stringify({ error: "Thread not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Save user message
        await supabase.from("marco_messages").insert({
            threadId,
            role: "user",
            content: message,
        });

        // Load history
        const { data: history } = await supabase
            .from("marco_messages")
            .select("*")
            .eq("threadId", threadId)
            .order("createdAt", { ascending: true })
            .limit(20);

        const geminiHistory: Content[] = (history || [])
            .filter(m => m.role === "user" || m.role === "assistant")
            .map(m => ({
                role: m.role === "assistant" ? ("model" as const) : ("user" as const),
                parts: m.partsJson ? JSON.parse(m.partsJson) : [{ text: m.content }],
            }));

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    let finalText = "";
                    let finalPartsJson: string | null = null;
                    let contents: Content[] = [...geminiHistory];
                    let toolCallCount = 0;

                    while (toolCallCount < 5) {
                        const response = await getGenAI().models.generateContent({
                            model: MARCO_MODEL,
                            contents,
                            config: {
                                systemInstruction: MARCO_SYSTEM_PROMPT,
                                tools: [{ functionDeclarations: MARCO_TOOL_DECLARATIONS }],
                            },
                        });

                        const candidate = response.candidates?.[0];
                        if (!candidate?.content?.parts) break;

                        const parts = candidate.content.parts;
                        const functionCalls = parts.filter(
                            (p: Part): p is Part & { functionCall: FunctionCall } =>
                                p.functionCall !== undefined
                        );

                        if (functionCalls.length > 0) {
                            toolCallCount++;
                            contents.push({ role: "model", parts });

                            for (const fc of functionCalls) {
                                const toolName = fc.functionCall.name as ToolName;
                                const toolArgs = (fc.functionCall.args as Record<string, any>) || {};

                                controller.enqueue(
                                    encoder.encode(`data: ${JSON.stringify({ type: "tool_use", tool: toolName })}\n\n`)
                                );

                                const result = await executeTool(
                                    toolName,
                                    {
                                        accessToken: session?.access_token || "",
                                        rpcBaseUrl: process.env.VASOLI_BACKEND_URL
                                            ? new URL("/rpc", process.env.VASOLI_BACKEND_URL).toString().replace(/\/$/, "")
                                            : new URL(process.env.NEXT_PUBLIC_RPC_BASE_URL || "/rpc", req.url).toString(),
                                    },
                                    toolArgs
                                );

                                contents.push({
                                    role: "user",
                                    parts: [{ functionResponse: { name: toolName, response: result } }],
                                });
                            }
                            continue;
                        }

                        // Final text response with streaming
                        const streamResponse = await getGenAI().models.generateContentStream({
                            model: MARCO_MODEL,
                            contents,
                            config: {
                                systemInstruction: MARCO_SYSTEM_PROMPT,
                                tools: [{ functionDeclarations: MARCO_TOOL_DECLARATIONS }],
                            },
                        });

                        let fullContentParts: Part[] = [];
                        // The streamResponse itself is the async generator in this SDK version
                        for await (const chunk of streamResponse) {
                            const chunkParts = chunk.candidates?.[0]?.content?.parts;
                            if (chunkParts) {
                                for (const part of chunkParts) {
                                    if (part.text) {
                                        finalText += part.text;
                                        controller.enqueue(
                                            encoder.encode(`data: ${JSON.stringify({ type: "text", content: part.text })}\n\n`)
                                        );
                                    }
                                    fullContentParts.push(part);
                                }
                            }
                        }
                        finalPartsJson = JSON.stringify(fullContentParts);
                        break;
                    }

                    if (finalText) {
                        await supabase.from("marco_messages").insert({
                            threadId,
                            role: "assistant",
                            content: finalText,
                            partsJson: finalPartsJson,
                        });

                        const { count } = await supabase
                            .from("marco_messages")
                            .select("*", { count: "exact", head: true })
                            .eq("threadId", threadId);

                        if (count && count <= 2) {
                            const title = message.length > 50 ? message.slice(0, 47) + "..." : message;
                            await supabase
                                .from("marco_threads")
                                .update({ title, lastMessageAt: new Date().toISOString() })
                                .eq("id", threadId);
                        } else {
                            await supabase
                                .from("marco_threads")
                                .update({ lastMessageAt: new Date().toISOString() })
                                .eq("id", threadId);
                        }
                    }

                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
                    controller.close();
                } catch (err) {
                    logError("[marco/chat] stream", err);
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ type: "error", content: "Sorry, something went wrong." })}\n\n`)
                    );
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            },
        });
    } catch (err) {
        logError("[marco/chat]", err);
        return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
