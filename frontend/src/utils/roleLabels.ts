import type { User } from "../types";

// 부서담당은 소속 부서명을, 그 외(팀계담당 등)는 소속 팀(계)명을 표시 라벨로 쓴다.
// CourseCard/CourseDetailModal이 각자 계산하던 동일한 로직을 하나로 모았다.
export function getOrgUnitLabel(
  user: User | null | undefined,
  isDeptManager: boolean,
): string {
  return isDeptManager ? (user?.department ?? "") : (user?.team ?? "");
}
