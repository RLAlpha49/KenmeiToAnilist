import { describe, it, expect } from "vitest";
import { cn } from "@/utils/tailwind";

describe("tailwind utils", () => {
  describe("cn", () => {
    it("combines class names", () => {
      const result = cn("class1", "class2");
      expect(result).toBe("class1 class2");
    });

    it("handles undefined and null values", () => {
      const result = cn("class1", undefined, "class2", null);
      expect(result).toBe("class1 class2");
    });

    it("handles boolean conditions", () => {
      const trueCondition = true;
      const falseCondition = false;
      const result = cn(
        "base-class",
        trueCondition && "conditional-true",
        falseCondition && "conditional-false",
      );
      expect(result).toBe("base-class conditional-true");
    });

    it("handles empty strings", () => {
      const result = cn("class1", "", "class2");
      expect(result).toBe("class1 class2");
    });

    it("handles array of class names", () => {
      const classArray = ["array-class1", "array-class2"];
      const result = cn("class1", classArray);
      expect(result).toBe("class1 array-class1 array-class2");
    });

    it("combines multiple types of arguments", () => {
      const condition = true;
      const classArray = ["array-class1", "array-class2"];

      const result = cn(
        "base-class",
        condition && "conditional-class",
        !condition && "never-added",
        undefined,
        null,
        classArray,
        "",
      );

      expect(result).toBe(
        "base-class conditional-class array-class1 array-class2",
      );
    });
  });
});
