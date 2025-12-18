import { describe, expect, it } from "vitest";

describe("OpenRouter API Configuration", () => {
  it("should have OPENROUTER_API_KEY environment variable set", () => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe("");
    expect(apiKey?.startsWith("sk-or-")).toBe(true);
  });
});

describe("Supabase Configuration", () => {
  it("should have VITE_SUPABASE_URL environment variable set", () => {
    const url = process.env.VITE_SUPABASE_URL;
    expect(url).toBeDefined();
    expect(url).toContain("supabase.co");
  });

  it("should have VITE_SUPABASE_ANON_KEY environment variable set", () => {
    const key = process.env.VITE_SUPABASE_ANON_KEY;
    expect(key).toBeDefined();
    expect(key).not.toBe("");
  });
});
