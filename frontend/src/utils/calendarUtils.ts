import type { Course } from "../types";

export type CourseStatus = "urgent" | "normal" | "done";

export interface CalendarEvent {
  courseId: number;
  name: string;
  status: CourseStatus;
}

const STATUS_ORDER: Record<CourseStatus, number> = {
  urgent: 0,
  normal: 1,
  done: 2,
};

export function classifyCourseStatus(
  course: Course,
  isDone: boolean,
): CourseStatus {
  if (isDone) return "done";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(course.end_date);
  endDate.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil(
    (endDate.getTime() - today.getTime()) / (1000 * 3600 * 24),
  );

  // 마감 7일 이내(당일 포함)면 임박, 그 외(마감 지난 것 포함)는 일반으로 분류한다.
  return diffDays >= 0 && diffDays <= 7 ? "urgent" : "normal";
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function toDateKey(isoDateStr: string): string {
  return isoDateStr.slice(0, 10);
}

export function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstOfMonth.getDay(); // 0 = 일요일
  const gridStart = new Date(year, month, 1 - startDayOfWeek);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

export function groupEventsByDate(
  courses: Course[],
  getEnrollment: (courseId: number) => { state: number } | undefined,
): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();

  for (const course of courses) {
    const isDone = !!getEnrollment(course.id);
    const status = classifyCourseStatus(course, isDone);
    const key = toDateKey(course.end_date);

    const list = map.get(key) ?? [];
    list.push({ courseId: course.id, name: course.name, status });
    map.set(key, list);
  }

  for (const list of map.values()) {
    list.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  }

  return map;
}

export const TIER_MAX_VISIBLE = { base: 2, md: 3, lg: 4 } as const;

export function itemVisibilityClass(index: number): string {
  if (index < TIER_MAX_VISIBLE.base) return "";
  if (index < TIER_MAX_VISIBLE.md) return "hidden md:block";
  if (index < TIER_MAX_VISIBLE.lg) return "hidden lg:block";
  return "hidden";
}

export function overflowCounts(total: number) {
  return {
    base: Math.max(0, total - TIER_MAX_VISIBLE.base),
    md: Math.max(0, total - TIER_MAX_VISIBLE.md),
    lg: Math.max(0, total - TIER_MAX_VISIBLE.lg),
  };
}
