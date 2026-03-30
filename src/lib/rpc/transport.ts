import { createConnectTransport } from "@connectrpc/connect-web";
import { createClient as createSupabaseClient } from "@/lib/supabase/browser";

const supabase = createSupabaseClient();

function createRequestId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Create a transport to connect to the backend RPC server
export const transport = createConnectTransport({
    baseUrl: process.env.NEXT_PUBLIC_RPC_BASE_URL || "/rpc",
    interceptors: [
        (next) => async (req) => {
            req.header.set("x-request-id", createRequestId());

            // Add Supabase auth token
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.access_token) {
                req.header.set("Authorization", `Bearer ${session.access_token}`);
            }

            return next(req);
        },
    ],
});
