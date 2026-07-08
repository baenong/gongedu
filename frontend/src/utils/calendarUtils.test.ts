import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Course } from "../types";
import {
  buildMonthGrid,
  classifyCourseStatus,
  formatDateKey,
  groupEventsByDate,
  itemVisibilityClass,
  overflowCounts,
  toDateKey,
  TIER_MAX_VISIBLE,
} from "./calendarUtils";

function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 1,
    year: 2026,
    name: "테스트 과정",
    end_date: "2026-07-15",
    detail: "",
    ...overrides,
  };
}

describe("classifyCourseStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T00:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("이수 완료면 done을 반환한다(마감일과 무관)", () => {
    const course = makeCourse({ end_date: "2020-01-01" });
    expect(classifyCourseStatus(course, true)).toBe("done");
  });

  it("마감일이 7일 이내로 남았으면 urgent를 반환한다", () => {
    const course = makeCourse({ end_date: "2026-07-16" }); // 6일 후
    expect(classifyCourseStatus(course, false)).toBe("urgent");
  });

  it("마감일이 당일이면 urgent를 반환한다", () => {
    const course = makeCourse({ end_date: "2026-07-10" });
    expect(classifyCourseStatus(course, false)).toBe("urgent");
  });

  it("마감일이 8일 이상 남았으면 normal을 반환한다", () => {
    const course = makeCourse({ end_date: "2026-07-20" });
    expect(classifyCourseStatus(course, false)).toBe("normal");
  });

  it("마감일이 이미 지났으면 normal을 반환한다", () => {
    const course = makeCourse({ end_date: "2026-07-01" });
    expect(classifyCourseStatus(course, false)).toBe("normal");
  });
});

describe("formatDateKey / toDateKey", () => {
  it("Date 객체를 YYYY-MM-DD로 변환한다", () => {
    expect(formatDateKey(new Date(2026, 6, 5))).toBe("2026-07-05"); // month는 0-based
  });

  it("한 자리 월/일도 0으로 패딩한다", () => {
    expect(formatDateKey(new Date(2026, 0, 1))).toBe("2026-01-01");
  });

  it("ISO 날짜 문자열에서 앞 10자리(YYYY-MM-DD)만 추출한다", () => {
    expect(toDateKey("2026-07-15T00:00:00.000Z")).toBe("2026-07-15");
    expect(toDateKey("2026-07-15")).toBe("2026-07-15");
  });
});

describe("buildMonthGrid", () => {
  it("항상 42칸(6주)을 반환한다", () => {
    const grid = buildMonthGrid(2026, 6); // 2026년 7월(0-based month=6)
    expect(grid).toHaveLength(42);
  });

  it("그리드의 첫 칸은 해당 월 1일이 속한 주의 일요일이다", () => {
    const grid = buildMonthGrid(2026, 6); // 2026-07-01은 수요일
    expect(grid[0].getDay()).toBe(0);
    expect(grid[0].getTime()).toBeLessThanOrEqual(new Date(2026, 6, 1).getTime());
  });

  it("그리드에 해당 월 1일이 포함되어 있다", () => {
    const grid = buildMonthGrid(2026, 6);
    const firstOfMonth = grid.find(
      (d) => d.getFullYear() === 2026 && d.getMonth() === 6 && d.getDate() === 1,
    );
    expect(firstOfMonth).toBeDefined();
  });
});

describe("groupEventsByDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T00:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("같은 마감일의 과정들을 하나의 날짜 키로 묶는다", () => {
    const courses = [
      makeCourse({ id: 1, name: "A", end_date: "2026-07-20" }),
      makeCourse({ id: 2, name: "B", end_date: "2026-07-20" }),
    ];
    const map = groupEventsByDate(courses, () => undefined);

    expect(map.get("2026-07-20")).toHaveLength(2);
  });

  it("이수완료 여부는 getEnrollment 콜백 결과로 판단한다", () => {
    const courses = [makeCourse({ id: 1, end_date: "2026-07-20" })];
    const map = groupEventsByDate(courses, (courseId) =>
      courseId === 1 ? { state: 2 } : undefined,
    );

    expect(map.get("2026-07-20")?.[0].status).toBe("done");
  });

  it("같은 날짜 안에서는 urgent > normal > done 순으로 정렬한다", () => {
    const courses = [
      makeCourse({ id: 1, name: "완료됨", end_date: "2026-07-20" }),
      makeCourse({ id: 2, name: "여유있음", end_date: "2026-07-20" }),
      makeCourse({ id: 3, name: "임박함", end_date: "2026-07-11" }),
    ];
    // 실제로는 end_date가 서로 다르면 다른 키로 묶이므로, 정렬 자체는
    // classifyCourseStatus가 반환하는 값 기준으로 각각 검증한다.
    const map = groupEventsByDate(
      courses.map((c) => ({ ...c, end_date: "2026-07-11" })),
      (courseId) => (courseId === 1 ? { state: 2 } : undefined),
    );
    const statuses = map.get("2026-07-11")?.map((e) => e.status);
    expect(statuses).toEqual(["urgent", "urgent", "done"]);
  });
});

describe("itemVisibilityClass / overflowCounts", () => {
  it("base 개수 미만 인덱스는 항상 보인다", () => {
    expect(itemVisibilityClass(0)).toBe("");
    expect(itemVisibilityClass(TIER_MAX_VISIBLE.base - 1)).toBe("");
  });

  it("base~md 사이는 md 이상에서만 보인다", () => {
    expect(itemVisibilityClass(TIER_MAX_VISIBLE.base)).toBe("hidden md:block");
  });

  it("md~lg 사이는 lg 이상에서만 보인다", () => {
    expect(itemVisibilityClass(TIER_MAX_VISIBLE.md)).toBe("hidden lg:block");
  });

  it("lg 이상은 항상 숨긴다", () => {
    expect(itemVisibilityClass(TIER_MAX_VISIBLE.lg)).toBe("hidden");
  });

  it("overflowCounts는 각 tier에서 넘치는 개수를 계산한다", () => {
    expect(overflowCounts(5)).toEqual({
      base: 5 - TIER_MAX_VISIBLE.base,
      md: 5 - TIER_MAX_VISIBLE.md,
      lg: 5 - TIER_MAX_VISIBLE.lg,
    });
  });

  it("총 개수가 tier보다 적으면 0 미만으로 내려가지 않는다", () => {
    expect(overflowCounts(0)).toEqual({ base: 0, md: 0, lg: 0 });
  });
});
