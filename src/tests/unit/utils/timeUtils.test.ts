import { describe, it, expect } from "vitest";
import { formatTimeRemaining } from "@/utils/timeUtils";

describe("timeUtils", () => {
  describe("formatTimeRemaining", () => {
    it("should format seconds correctly", () => {
      expect(formatTimeRemaining(1)).toBe("1 second");
      expect(formatTimeRemaining(10)).toBe("10 seconds");
    });

    it("should format minutes and seconds correctly", () => {
      expect(formatTimeRemaining(60)).toBe("1 minute 0 seconds");
      expect(formatTimeRemaining(65)).toBe("1 minute 5 seconds");
      expect(formatTimeRemaining(125)).toBe("2 minutes 5 seconds");
    });

    it("should format hours and minutes correctly", () => {
      expect(formatTimeRemaining(3600)).toBe("1 hour 0 minutes");
      expect(formatTimeRemaining(3720)).toBe("1 hour 2 minutes");
      expect(formatTimeRemaining(7200)).toBe("2 hours 0 minutes");
    });
  });
});
