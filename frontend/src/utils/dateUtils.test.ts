import { describe, expect, it } from "vitest";
import { formatDateWithDay, formatShortDate } from "./dateUtils";

describe("formatDateWithDay", () => {
  it("날짜 뒤에 요일을 괄호로 붙인다", () => {
    // 2026-07-06은 월요일
    expect(formatDateWithDay("2026-07-06")).toBe("2026-07-06 (월)");
  });

  it("빈 문자열이면 빈 문자열을 반환한다", () => {
    expect(formatDateWithDay("")).toBe("");
  });
});

describe("formatShortDate", () => {
  it("YYYY-MM-DD를 YY.MM.DD로 축약한다", () => {
    expect(formatShortDate("2026-07-06")).toBe("26.07.06");
  });

  it("빈 문자열이면 빈 문자열을 반환한다", () => {
    expect(formatShortDate("")).toBe("");
  });
});
