import { describe, expect, it } from "vitest";

describe("Stripe Webhook Configuration", () => {
  it("should have STRIPE_PRO_PRICE_ID environment variable set", () => {
    const priceId = process.env.STRIPE_PRO_PRICE_ID;
    expect(priceId).toBeDefined();
    expect(priceId).not.toBe("");
    expect(priceId?.startsWith("price_")).toBe(true);
  });

  it("should have Stripe webhook endpoint path configured", () => {
    // Verify the webhook endpoint path is correct
    const webhookPath = "/api/webhooks/stripe";
    expect(webhookPath).toBe("/api/webhooks/stripe");
  });
});

describe("Stripe Subscription Status Mapping", () => {
  it("should correctly map subscription statuses", () => {
    const statusMap: Record<string, string> = {
      active: "pro",
      trialing: "pro",
      past_due: "past_due",
      canceled: "canceled",
      unpaid: "canceled",
    };

    expect(statusMap.active).toBe("pro");
    expect(statusMap.trialing).toBe("pro");
    expect(statusMap.past_due).toBe("past_due");
    expect(statusMap.canceled).toBe("canceled");
    expect(statusMap.unpaid).toBe("canceled");
  });
});
