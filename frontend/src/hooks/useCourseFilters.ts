import { useCallback, useMemo, useState } from "react";
import type { Department, SelectOption, Team } from "../types";
import type {
  CourseStatusFilters,
  UserStatus,
} from "../components/CourseDetailModal";

const DEFAULT_TEAM_OPTIONS = [{ label: "모든 팀(계)", value: -1 }];

const COMPLETE_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "done", label: "🟢 이수완료" },
  { value: "yet", label: "🟠 미이수" },
];

const AI_FILTER_OPTIONS = [
  { value: "all", label: "AI검증 전체" },
  { value: "unverified", label: "❓ 미검증" },
  { value: "flagged", label: "⚠️ 의심" },
  { value: "ok", label: "🟢 정상" },
];

// CourseDetailModal의 이수현황 필터(부서/팀/이수여부/AI검증) 상태와 파생 옵션을 관리한다.
export function useCourseFilters(
  departments: Department[],
  allTeams: Team[],
  courseStatusList: UserStatus[],
) {
  const [filterDepartment, setFilterDepartment] = useState(-1);
  const [filterTeam, setFilterTeam] = useState(-1);
  const [filterState, setFilterState] = useState("all");
  const [filterAiStatus, setFilterAiStatus] = useState("all");
  const [filterTeamOptions, setFilterTeamOptions] =
    useState<SelectOption[]>(DEFAULT_TEAM_OPTIONS);

  const departmentOptions = useMemo(
    () => [
      { value: -1, label: "모든 부서" },
      ...departments.map((d) => ({ value: d.id, label: d.name })),
    ],
    [departments],
  );

  // 교육과정 등록 폼용 — "모든 부서"(필터 전용 옵션) 없이 실제 부서만 나열
  const courseDepartmentOptions = useMemo(
    () => departments.map((d) => ({ value: d.id, label: d.name })),
    [departments],
  );

  const handleFilterDeptChange = useCallback(
    (deptId: number) => {
      setFilterDepartment(deptId);
      setFilterTeam(-1);
      const filtered = allTeams.filter((t) => t.departmentId === deptId);
      setFilterTeamOptions([
        { label: "모든 팀(계)", value: -1 },
        ...(deptId === -1
          ? []
          : filtered.map((t) => ({ label: t.name, value: t.id }))),
      ]);
    },
    [allTeams],
  );

  // 상세 모달을 새로 열 때 이전 조회의 필터가 남아있지 않도록 초기화한다.
  // (filterAiStatus는 대상 교육과정이 바뀌어도 유지하고 싶은 값이라 원래도 초기화 대상이 아니었다.)
  const resetFilters = () => {
    setFilterDepartment(-1);
    setFilterTeam(-1);
    setFilterTeamOptions(DEFAULT_TEAM_OPTIONS);
    setFilterState("all");
  };

  const filteredStatusList = useMemo(
    () =>
      courseStatusList.filter((status) => {
        const matchDepartment =
          filterDepartment === -1 || status.departmentId === filterDepartment;

        const matchTeam = filterTeam === -1 || status.teamId === filterTeam;

        const matchState =
          filterState === "all" ||
          (filterState === "done" && status.state === 2) ||
          (filterState === "yet" && status.state !== 2);

        const matchAiStatus =
          filterAiStatus === "all" ||
          (filterAiStatus === "unverified" &&
            status.state === 2 &&
            status.ai_verified === false) ||
          (filterAiStatus === "flagged" &&
            status.state === 2 &&
            status.ai_flagged === 1) ||
          (filterAiStatus === "ok" &&
            status.state === 2 &&
            status.ai_verified === true &&
            status.ai_flagged === 0);

        return matchDepartment && matchTeam && matchState && matchAiStatus;
      }),
    [courseStatusList, filterDepartment, filterTeam, filterState, filterAiStatus],
  );

  // CourseDetailModal이 그대로 받는 형태(CourseStatusFilters)로 미리 묶어서 반환한다.
  // MainPage는 이 객체를 분해하지 않고 filters={filters}로 그대로 전달하면 된다.
  const filters: CourseStatusFilters = useMemo(
    () => ({
      department: filterDepartment,
      team: filterTeam,
      state: filterState,
      aiStatus: filterAiStatus,
      departmentOptions,
      teamOptions: filterTeamOptions,
      stateOptions: COMPLETE_OPTIONS,
      aiStatusOptions: AI_FILTER_OPTIONS,
      onDepartmentChange: handleFilterDeptChange,
      onTeamChange: setFilterTeam,
      onStateChange: setFilterState,
      onAiStatusChange: setFilterAiStatus,
    }),
    [
      filterDepartment,
      filterTeam,
      filterState,
      filterAiStatus,
      departmentOptions,
      filterTeamOptions,
      handleFilterDeptChange,
    ],
  );

  return {
    filters,
    courseDepartmentOptions,
    filteredStatusList,
    resetFilters,
    // 부서담당 시나리오처럼 조회 응답에서 팀 옵션을 계산해야 하는 경우를 위해 노출.
    setFilterTeamOptions,
  };
}
