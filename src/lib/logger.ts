/** Log operational metadata only. Never serialize provider errors or financial payloads. */
const safeFields = new Set(["requestId", "method", "code", "status", "count", "durationMs", "retryable"]);
function metadata(data?: Record<string, unknown>) {
    if (!data) return undefined;
    return Object.fromEntries(Object.entries(data).filter(([key, value]) => safeFields.has(key) && (typeof value === "number" || typeof value === "boolean" || (typeof value === "string" && /^[a-zA-Z0-9_.:/-]{1,100}$/.test(value)))));
}
export const logger = {
    info(message: string, data?: Record<string, unknown>) {
        if (process.env.NODE_ENV !== "production") console.info(`[INFO] ${message}`, metadata(data));
    },
    warn(message: string, data?: Record<string, unknown>) { console.warn(`[WARN] ${message}`, metadata(data)); },
    error(message: string, _error?: unknown, data?: Record<string, unknown>) { console.error(`[ERROR] ${message}`, metadata(data)); },
};
export const logError = (context: string, error: unknown) => logger.error(context, error);
