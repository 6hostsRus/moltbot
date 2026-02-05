import { describe, it, expect } from "vitest";
import { maskPII } from "../src/utils/masking";

describe("masking utils", () => {
  it("masks emails", () => {
    const s = "contact me at alice@example.com";
    const out = maskPII(s);
    expect(out).toContain("@example.com");
    expect(out).not.toContain("alice@example.com");
  });

  it("masks credit-card like numbers", () => {
    const s = "card 4242-4242-4242-4242";
    const out = maskPII(s);
    expect(out).toContain("XXXX-XXXX-XXXX-XXXX");
  });
});
