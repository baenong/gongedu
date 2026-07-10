import { useMemo } from "react";
import type { SelectOption, Team } from "../types";

// "팀(계) 미지정" 값. users.team_id는 DB 스키마에서 DEFAULT 0으로 FK 기본값이
// "미지정" 팀(id=0, database.js 초기화 시 항상 생성됨)을 가리키도록 되어 있으므로,
// 팀을 선택하지 않은 상태도 실제로 제출 가능한 값인 0이어야 한다. (필터 목록의
// "전체" sentinel과는 다른 개념 — 그건 -1을 쓴다. useCourseFilters.ts 참고)
export const NO_TEAM_OPTION: SelectOption = { label: "미지정", value: 0 };

// 선택된 부서에 속한 팀(계) 목록과, "미지정" 옵션이 앞에 붙은 Select 옵션을 계산한다.
// UserCreateModal/UserEditModal처럼 부서→팀 배정 폼을 갖는 곳에서 공통으로 사용한다.
export function useTeamSelect(allTeams: Team[], departmentId: number) {
  const teams = useMemo(
    () => allTeams.filter((t) => t.departmentId === departmentId),
    [allTeams, departmentId],
  );

  const teamOptions: SelectOption[] = useMemo(() => {
    const options = teams.map((t) => ({ label: t.name, value: t.id }));
    // "미지정" 부서(id=0) 자체를 선택한 경우, 그 부서의 실제 팀 목록에 이미
    // "미지정" 팀(id=0)이 포함되어 있으므로 중복으로 추가하지 않는다.
    const alreadyHasNoTeam = teams.some((t) => t.id === NO_TEAM_OPTION.value);
    return alreadyHasNoTeam ? options : [NO_TEAM_OPTION, ...options];
  }, [teams]);

  return { teams, teamOptions };
}

// 부서 선택이 바뀌면 부서명을 갱신하고, 이전 부서에 종속된 팀 선택은 리셋한다.
export function applyDepartmentChange<
  T extends {
    department: string;
    departmentId: number;
    team: string;
    teamId: number;
  },
>(form: T, departmentOptions: SelectOption[], departmentId: number): T {
  const departmentName =
    departmentOptions.find((d) => d.value === departmentId)?.label ?? "";
  return {
    ...form,
    department: departmentName,
    departmentId,
    team: "",
    teamId: NO_TEAM_OPTION.value as number,
  };
}

// 팀 선택이 바뀌면 팀명을 함께 갱신한다.
export function applyTeamChange<T extends { team: string; teamId: number }>(
  form: T,
  teams: Team[],
  teamId: number,
): T {
  const teamName = teams.find((t) => t.id === teamId)?.name ?? "";
  return { ...form, teamId, team: teamName };
}
