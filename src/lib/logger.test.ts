import { afterEach, expect, it, vi } from "vitest";
import { logger } from "./logger";
afterEach(() => vi.restoreAllMocks());
it("does not serialize sensitive provider errors or nested finance payloads", () => {
    const output=vi.spyOn(console,"error").mockImplementation(()=>{});
    logger.error("rpc.failed",new Error("statement: rent secret-token"),{code:"INTERNAL",requestId:"req-1",payload:{ocrText:"private receipt"},email:"test@example.com"});
    const serialized=JSON.stringify(output.mock.calls);
    expect(serialized).toContain("INTERNAL");
    expect(serialized).not.toMatch(/rent|secret-token|private receipt|test@example/);
});
