import { useState } from "react";
import type { Department, Team } from "../types";
import type { UserStatus } from "../components/CourseDetailModal";

const DEFAULT_TEAM_OPTIONS = [{ label: "모든 팀(계)", value: 0 }];

// CourseDetailModal의 이수현황 필터(부서/팀/이수여부/AI검증) 상태와 파생 옵션을 관리한다.
export function useCourseFilters(
  departments: Department[],
  allTeams: Team[],
  courseStatusList: UserStatus[],
) {
  const [filterDepartment, setFilterDepartment] = useState(0);
  const [filterTeam, setFilterTeam] = useState(0);
  const [filterState, setFilterState] = useState("all");
  const [filterAiStatus, setFilterAiStatus] = useState("all");
  const [filterTeamOptions, setFilterTeamOptions] = useState<
    { value: number; label: string }[]
  >(DEFAULT_TEAM_OPTIONS);

  const departmentOptions = [
    { value: 0, label: "모든 부서" },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ];

  // 교육과정 등록 폼용 — "모든 부서"(필터 전용 옵션) 없이 실제 부서만 나열
  const courseDepartmentOptions = departments.map((d) => ({
    value: d.id,
    label: d.name,
  }));

  const completeOptions = [
    { value: "all", label: "전체" },
    { value: "done", label: "🟢 이수완료" },
    { value: "yet", label: "🟠 미이수" },
  ];

  const aiFilterOptions = [
    { value: "all", label: "AI검증 전체" },
    { value: "unverified", label: "❓ 미검증" },
    { value: "flagged", label: "⚠️ 의심" },
    { value: "ok", label: "🟢 정상" },
  ];

  const handleFilterDeptChange = (deptId: number) => {
    setFilterDepartment(deptId);
    setFilterTeam(0);
    const filtered = allTeams.filter((t) => t.departmentId === deptId);
    setFilterTeamOptions([
      { label: "모든 팀(계)", value: 0 },
      ...(deptId === 0
        ? []
        : filtered.map((t) => ({ label: t.name, value: t.id }))),
    ]);
  };

  // 상세 모달을 새로 열 때 이전 조회의 필터가 남아있지 않도록 초기화한다.
  // (filterAiStatus는 대상 교육과정이 바뀌어도 유지하고 싶은 값이라 원래도 초기화 대상이 아니었다.)
  const resetFilters = () => {
    setFilterDepartment(0);
    setFilterTeam(0);
    setFilterTeamOptions(DEFAULT_TEAM_OPTIONS);
    setFilterState("all");
  };

  const filteredStatusList = courseStatusList.filter((status) => {
    const matchDepartment =
      filterDepartment === 0 || status.departmentId === filterDepartment;

    const matchTeam = filterTeam === 0 || status.teamId === filterTeam;

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
  });

  return {
    filterDepartment,
    filterTeam,
    filterState,
    filterAiStatus,
    filterTeamOptions,
    setFilterTeam,
    setFilterState,
    setFilterAiStatus,
    setFilterTeamOptions,
    departmentOptions,
    courseDepartmentOptions,
    completeOptions,
    aiFilterOptions,
    handleFilterDeptChange,
    resetFilters,
    filteredStatusList,
  };
}
