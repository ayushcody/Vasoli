import { createConnectTransport } from "@connectrpc/connect-web";
import { ConnectError, Code } from "@connectrpc/connect";
import { createClient as createSupabaseClient } from "@/lib/supabase/browser";
import { logger } from "@/lib/logger";

const supabase = createSupabaseClient();

function createRequestId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeError(err: unknown): Error {
    if (err instanceof ConnectError) {
        // Log the full Connect error in development mode
        logger.error(`RPC Failed [${Code[err.code]}]`, err);

        switch (err.code) {
            case Code.Unauthenticated:
                return new Error("Please sign in to continue.");
            case Code.PermissionDenied:
                return new Error("You do not have permission to perform this action.");
            case Code.NotFound:
                return new Error("The requested resource was not found.");
            case Code.InvalidArgument:
                // Pass through validation errors if they are safe
                return new Error(err.rawMessage || "Invalid request parameters.");
            case Code.Internal:
            case Code.Unavailable:
            default:
                return new Error("Something went wrong on our end. Please try again.");
        }
    }

    logger.error("Unknown RPC Transport Error", err);
    return new Error("An unexpected error occurred. Please check your connection.");
}

// Create a transport to connect to the backend RPC server
export const transport = createConnectTransport({
    baseUrl: process.env.NEXT_PUBLIC_RPC_BASE_URL || "/rpc",
    interceptors: [
        (next) => async (req) => {
            const reqId = createRequestId();
            req.header.set("x-request-id", reqId);

            // Add Supabase auth token
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.access_token) {
                req.header.set("Authorization", `Bearer ${session.access_token}`);
            }

            try {
                return await next(req);
            } catch (err) {
                throw normalizeError(err);
            }
        },
    ],
});
