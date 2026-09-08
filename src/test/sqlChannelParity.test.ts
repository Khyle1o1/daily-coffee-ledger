import { describe, expect, it } from "vitest";
import { getChannelFromPaymentType } from "@/lib/reports/channel";
import fixture from "./fixtures/sqlChannelDerivation.json";

/**
 * report_line_totals stores a channel derived in SQL (migration 028), while the
 * rest of the app derives it in TypeScript. If the two ever disagree, channel
 * reports silently misattribute sales.
 *
 * The fixture is every distinct paymentType in the database paired with the
 * channel the SQL CASE produced for it.
 */
describe("SQL channel derivation matches getChannelFromPaymentType", () => {
  it("agrees on every paymentType present in the data", () => {
    const disagreements = fixture
      .map(({ paymentType, channel }) => ({
        paymentType,
        sql: channel,
        ts: getChannelFromPaymentType(paymentType),
      }))
      .filter((r) => r.sql !== r.ts);

    expect(disagreements).toEqual([]);
  });

  it("covers the split-payment case that startsWith exists to protect", () => {
    // "Cash 20 + Grab 180" contains "grab" but is a walk-in paid partly with
    // GrabPay. Both sides must classify it as walk-in, not Grab delivery.
    const splits = fixture.filter(
      ({ paymentType }) =>
        /grab|panda/i.test(paymentType ?? "") &&
        !/^\s*(grab|foodpanda|food panda)/i.test(paymentType ?? ""),
    );
    expect(splits.length).toBeGreaterThan(0);
    for (const { paymentType, channel } of splits) {
      expect(channel).toBe("WALK_IN");
      expect(getChannelFromPaymentType(paymentType)).toBe("WALK_IN");
    }
  });
});
