import { createConnectTransport } from "@connectrpc/connect-web";
import { createClient as createSupabaseClient } from "@/lib/supabase/browser";

const supabase = createSupabaseClient();

// Create a transport to connect to the backend RPC server
export const transport = createConnectTransport({
    baseUrl: process.env.NEXT_PUBLIC_RPC_BASE_URL || "/rpc",
    interceptors: [
        (next) => async (req) => {
            // Add Supabase auth token
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.access_token) {
                req.header.set("Authorization", `Bearer ${session.access_token}`);
            }

            return next(req);
        },
    ],
});
