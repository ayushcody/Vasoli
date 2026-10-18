import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class { models = { get: provider.get }; },
  Type: { OBJECT: "OBJECT", STRING: "STRING", NUMBER: "NUMBER", ARRAY: "ARRAY", BOOLEAN: "BOOLEAN" },
}));

beforeEach(() => { vi.resetModules(); provider.get.mockReset(); });
afterEach(() => vi.unstubAllEnvs());

describe("optional Marco provider boundary", () => {
  it("makes no provider request when disabled", async () => {
    vi.stubEnv("MARCO_ENABLED", "false");
    const { verifyMarcoModel } = await import("./gemini");
    await expect(verifyMarcoModel()).rejects.toThrow("disabled");
    expect(provider.get).not.toHaveBeenCalled();
  });

  it("requires an explicit model rather than falling back to an obsolete name", async () => {
    vi.stubEnv("MARCO_ENABLED", "true");
    vi.stubEnv("GEMINI_API_MODEL", "");
    const { verifyMarcoModel } = await import("./gemini");
    await expect(verifyMarcoModel()).rejects.toThrow("explicit");
    expect(provider.get).not.toHaveBeenCalled();
  });

  it("rejects provider models without text generation and caches supported metadata only", async () => {
    vi.stubEnv("MARCO_ENABLED", "true");
    vi.stubEnv("GEMINI_API_MODEL", "gemini-configured-example");
    vi.stubEnv("GEMINI_API_KEY", "local-unit-fixture");
    provider.get.mockResolvedValueOnce({ supportedActions: ["embedContent"] });
    provider.get.mockResolvedValueOnce({ supportedActions: ["generateContent"] });
    const { verifyMarcoModel } = await import("./gemini");
    await expect(verifyMarcoModel()).rejects.toThrow("text generation");
    await verifyMarcoModel();
    await verifyMarcoModel();
    expect(provider.get).toHaveBeenCalledTimes(2);
    expect(provider.get).toHaveBeenLastCalledWith({ model: "gemini-configured-example" });
  });
});
