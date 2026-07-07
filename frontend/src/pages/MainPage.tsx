import React, { useEffect, useRef, useState } from "react";
import api from "../api/axios";
import axios from "axios";
import { useAuthStore } from "../store/authStore";
import type { Course, Enrollment, Department, Team } from "../types";
import { formatDateWithDay } from "../utils/dateUtils";
import Select from "../components/Select";
import TableHeader from "../components/TableHeader";
import toast from "react-hot-toast";
import Badge from "../components/Badge";
import FormButton from "../components/FormButton";
import FormLabel from "../components/FormLabel";
import TextInput from "../components/TextInput";
import CalendarView from "../components/CalendarView";
import SimpleCourseList from "../components/SimpleCourseList";
import { groupEventsByDate, type CalendarEvent } from "../utils/calendarUtils";
import { getErrorMessage } from "../utils/errorUtils";
import { roles } from "../utils/constants";

// 관리자용 이수현황 타입 정의
interface UserStatus {
  user_id: number;
  name: string;
  department: string;
  departmentId: number;
  team: string;
  teamId: number;
  enrollment_id: number | null;
  state: number | null; // 2: 제출완료
  submitted_at: string | null;
  file_name: string | null;
  stored_file_name: string | null;
  ai_flagged: number | null;
  ai_reasoning: string | null;
  ai_verified: boolean | null;
}

const MainPage = () => {
  const { user } = useAuthStore();
  const isManager = user?.role && user.role >= roles["팀계담당"];
  const isDeptManager = user?.role && user.role === roles["부서담당"];
  const isSuperAdmin = user?.role && user?.role >= roles["교육담당"];
  const isGeneralManager = user?.role && user?.role >= roles["총괄담당"];

  const thisYear = new Date().getFullYear();

  // 상태 관리
  const [courses, setCourses] = useState<Course[]>([]);
  const [myEnrollments, setMyEnrollments] = useState<Enrollment[]>([]);
  const [year, setYear] = useState(thisYear);
  const [showUnfinishedOnly, setShowUnfinishedOnly] = useState(false);
  const [showOwnCoursesOnly, setShowOwnCoursesOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [activeTab, setActiveTab] = useState<"calendar" | "cards">("calendar");
  const [scrollTargetCourseId, setScrollTargetCourseId] = useState<
    number | null
  >(null);

  useEffect(() => {
    const now = new Date();
    setCalendarMonth(year === now.getFullYear() ? now.getMonth() : 0);
  }, [year]);

  const courseRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [highlightedCourseIds, setHighlightedCourseIds] = useState<Set<number>>(
    new Set(),
  );

  useEffect(() => {
    if (activeTab !== "cards" || scrollTargetCourseId === null) return;
    courseRefs.current[scrollTargetCourseId]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    setScrollTargetCourseId(null);
  }, [activeTab, scrollTargetCourseId]);

  // 교육 등록 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCourse, setNewCourse] = useState({
    name: "",
    end_date: "",
    detail: "",
    department_id: 0,
  });

  // 상세정보 및 이수현황 모달 상태
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseStatusList, setCourseStatusList] = useState<UserStatus[]>([]);

  // 필터링
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [filterTeamOptions, setFilterTeamOptions] = useState<
    { value: number; label: string }[]
  >([{ label: "모든 팀(계)", value: 0 }]);

  const [filterDepartment, setFilterDepartment] = useState(0);
  const [filterTeam, setFilterTeam] = useState(0);
  const [filterState, setFilterState] = useState("all");
  const [filterAiStatus, setFilterAiStatus] = useState("all");

  const departmentOptions = [
    { value: 0, label: "모든 부서" },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
  ];

  // 교육과정 등록 폼용 — "모든 부서"(필터 전용 옵션) 없이 실제 부서만 나열
  const courseDepartmentOptions = departments.map((d) => ({
    value: d.id,
    label: d.name,
  }));

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

  const yearOptions = [thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map(
    (y) => ({
      value: y,
      label: `${y}년`,
    }),
  );

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

  // 데이터 불러오기
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const courseRes = await api.get(`/courses?year=${year}`);
      setCourses(courseRes.data);

      const enrollRes = await api.get("/enrollments/my");
      setMyEnrollments(enrollRes.data);

      if (isSuperAdmin) {
        const resDept = await api.get("/departments");
        setDepartments(resDept.data);
        const resTeam = await api.get("/departments/teams");
        setAllTeams(resTeam.data);
      }
    } catch (error) {
      console.error("데이터 로딩 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

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

  useEffect(() => {
    fetchData();
  }, [year]);

  // --- 사용자 기능 ---

  // AI 검증이 API 키 미설정으로 건너뛰어졌을 때 관리자에게만 안내
  const warnIfAiKeyMissing = (aiSkipReason: string | null | undefined) => {
    if (aiSkipReason !== "missing_api_key" || !isManager) return;
    toast(
      "AI 검증용 API 키가 설정되지 않아 자동 검증이 건너뛰어졌습니다. 설정 화면에서 API 키를 등록해주세요.",
      { icon: "⚠️", duration: 6000 },
    );
  };

  const handleFileUpload = async (courseId: number, file: File) => {
    if (
      !confirm(
        `${file.name} 파일을 제출하시겠습니까?\n\n수료증 파일에는 성명 등 개인정보가 포함될 수 있으며, 제출 시 서버(VM)에 저장됩니다.\n동의하지 않으시면 취소를 눌러주세요.`,
      )
    )
      return;
    const formData = new FormData();
    formData.append("file", file);

    toast.promise(
      api.post(`/enrollments/${courseId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
      {
        loading: "파일 업로드 중...",
        success: (res) => {
          fetchData();
          warnIfAiKeyMissing(res.data.aiSkipReason);
          return "정상적으로 제출되었습니다!";
        },
        error: (error) =>
          error.response?.data?.message || "업로드를 실패했습니다.",
      },
    );
  };

  const handleMyDownload = async (enrollmentId: number, fileName: string) => {
    try {
      const response = await api.get(`/enrollments/${enrollmentId}/download`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.log(error);
      toast.error("파일을 다운로드할 수 없습니다.");
    }
  };

  const deleteMyDownload = async (enrollmentId: number) => {
    if (!confirm("제출한 수료증을 삭제하시겠습니까?")) return;
    toast.promise(api.delete(`/enrollments/${enrollmentId}`), {
      loading: "제출내역 삭제 중...",
      success: () => {
        fetchData();
        return "정상적으로 삭제되었습니다!";
      },
      error: (error) =>
        error.response?.data?.message || "삭제 중 오류가 발생했습니다.",
    });
  };

  // --- 관리자 기능 ---

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/courses", { ...newCourse, year });
      toast.success("교육과정이 등록되었습니다.");
      setShowCreateModal(false);
      setNewCourse({ name: "", end_date: "", detail: "", department_id: 0 });
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, "등록 중 오류가 발생했습니다."));
    }
  };

  // 이 교육과정의 현황을 조회할 수 있는지 (담당 범위 내 조회 — 팀계/부서담당도 포함)
  const isOwnCourse = (course: Course) => {
    const role = user?.role ?? 0;
    if (role >= roles["총괄담당"]) return true; // 총괄담당 이상 — 항상 허용
    if (role === roles["교육담당"])
      // 교육담당 — 본인 소유만
      return course.created_by === user?.id;
    if (role >= roles["팀계담당"]) return true; // 부서담당, 팀계담당 — 담당 범위 조회는 항상 허용
    return false;
  };

  // 이 교육과정을 수정/삭제할 수 있는지 (실제 소유자만 — 팀계/부서담당은 조회만 가능하고 관리는 불가)
  const canManageCourse = (course: Course) => {
    const role = user?.role ?? 0;
    if (role >= roles["총괄담당"]) return true; // 총괄담당 이상 — 항상 허용
    if (role === roles["교육담당"]) return course.created_by === user?.id;
    return false;
  };

  // 상세 모달 열기 (직원 현황 조회)
  const openDetailModal = async (course: Course) => {
    setSelectedCourse(course);
    setShowDetailModal(true);

    // 모달 열 때마다 초기화
    setFilterDepartment(0);
    setFilterTeam(0);
    setFilterTeamOptions([{ label: "모든 팀(계)", value: 0 }]);
    setFilterState("all");
    setCourseStatusList([]);

    try {
      if (isManager && isOwnCourse(course)) {
        const res = await api.get(`/enrollments/course/${course.id}`);
        setFilterState("all");
        setCourseStatusList(res.data);

        // 부서담당: 응답 데이터에서 팀 목록 추출하여 팀 필터 옵션 구성
        if (isDeptManager) {
          const teamMap = new Map<number, string>();
          res.data.forEach((s: UserStatus) => {
            if (s.teamId) teamMap.set(s.teamId, s.team);
          });
          setFilterTeamOptions([
            { label: "모든 팀(계)", value: 0 },
            ...[...teamMap.entries()].map(([id, name]) => ({
              value: id,
              label: name,
            })),
          ]);
        }
      } else {
        if (!user) throw new Error("로그인해야합니다.");
        const res = await api.get(`/enrollments/my/${course.id}`);
        const userStat: UserStatus = {
          user_id: user.id,
          name: user.name,
          department: user.department,
          departmentId: user.departmentId,
          team: user.team,
          teamId: user.teamId,
          ...res.data,
        };
        setCourseStatusList([userStat]);
      }
    } catch (error) {
      console.error("현황 조회 실패", error);
      setCourseStatusList([]);
    }
  };

  // 개별 직원 수료증 다운로드 (모달 내부)
  const handleUserFileDownload = async (
    enrollmentId: number,
    fileName: string,
  ) => {
    handleMyDownload(enrollmentId, fileName); // 기존 함수 재사용
  };

  // 관리자 대리 등록 (미제출자를 대신 이수 등록)
  const handleProxyUpload = async (
    targetUserId: number,
    targetName: string,
    file: File,
  ) => {
    if (!selectedCourse) return;
    if (!confirm(`${targetName}님의 이수증을 등록하시겠습니까?`)) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", String(targetUserId));

    const uploadPromise = api
      .post(`/enrollments/${selectedCourse.id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then(async (res) => {
        const statusRes = await api.get(
          `/enrollments/course/${selectedCourse.id}`,
        );
        setCourseStatusList(statusRes.data);
        fetchData();
        return res;
      });

    toast.promise(uploadPromise, {
      loading: "등록 중...",
      success: (res) => {
        warnIfAiKeyMissing(res.data.aiSkipReason);
        return "정상적으로 등록되었습니다!";
      },
      error: (error) => error.response?.data?.message || "등록을 실패했습니다.",
    });
  };

  // 관리자(부서담당/교육담당/총괄담당 등)가 관할 범위 내 직원의 제출내역을 삭제
  // 실제 권한 검증은 서버(canAccessEnrollment)에서 최종적으로 수행한다.
  const handleAdminDeleteEnrollment = async (
    enrollmentId: number,
    targetName: string,
  ) => {
    if (!selectedCourse) return;
    if (!confirm(`${targetName}님의 제출한 수료증을 삭제하시겠습니까?`)) return;

    const deletePromise = api
      .delete(`/enrollments/${enrollmentId}`)
      .then(async (res) => {
        const statusRes = await api.get(
          `/enrollments/course/${selectedCourse.id}`,
        );
        setCourseStatusList(statusRes.data);
        fetchData();
        return res;
      });

    toast.promise(deletePromise, {
      loading: "제출내역 삭제 중...",
      success: "정상적으로 삭제되었습니다!",
      error: (error) =>
        error.response?.data?.message || "삭제 중 오류가 발생했습니다.",
    });
  };

  // 부서담당 이상이 AI 검증을 다시 실행 (미검증 건 대상)
  const handleReverifyEnrollment = async (
    enrollmentId: number,
    targetName: string,
  ) => {
    if (!selectedCourse) return;
    if (!confirm(`${targetName}님의 제출내역을 AI로 재검증하시겠습니까?`))
      return;

    const reverifyPromise = api
      .post(`/enrollments/${enrollmentId}/reverify`)
      .then(async (res) => {
        const statusRes = await api.get(
          `/enrollments/course/${selectedCourse.id}`,
        );
        setCourseStatusList(statusRes.data);
        return res;
      });

    toast.promise(reverifyPromise, {
      loading: "AI 재검증 중...",
      success: (res) => {
        warnIfAiKeyMissing(res.data.aiSkipReason);
        return res.data.message;
      },
      error: (error) =>
        error.response?.data?.message || "재검증 중 오류가 발생했습니다.",
    });
  };

  // ZIP 다운로드
  const handleZipDownload = async (courseId: number, courseName: string) => {
    try {
      const params: Record<string, number> = {};
      if (isSuperAdmin) {
        if (filterDepartment !== 0) params.departmentId = filterDepartment;
        if (filterTeam !== 0) params.teamId = filterTeam;
      }
      const response = await api.get(
        `/enrollments/course/${courseId}/download-zip`,
        { responseType: "blob", params },
      );

      let filename = `${courseName}_수료증.zip`;
      const disposition = response.headers["content-disposition"];

      if (disposition) {
        const filenameRegex = /filename="([^"]*)"/;
        const matches = filenameRegex.exec(disposition);
        if (matches && matches[1]) {
          filename = decodeURIComponent(matches[1]);
        }
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      if (axios.isAxiosError(error))
        toast.error("다운로드할 파일이 없거나 오류가 발생했습니다.");
    }
  };

  // 이수현황 CSV 다운로드
  const handleCsvDownload = () => {
    if (!selectedCourse) return;

    const headers = isSuperAdmin
      ? ["이름", "부서", "팀(계)", "이수여부", "제출일"]
      : ["이름", "팀(계)", "이수여부", "제출일"];

    const rows = filteredStatusList.map((status) => {
      const base = isSuperAdmin
        ? [status.name, status.department, status.team]
        : [status.name, status.team];
      return [
        ...base,
        status.state === 2 ? "이수완료" : "미이수",
        status.submitted_at ? status.submitted_at.split(" ")[0] : "-",
      ];
    });

    const csvContent =
      "﻿" +
      [headers, ...rows]
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
        )
        .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${selectedCourse.name}_이수현황.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  // 교육과정 삭제
  const handleDeleteCourse = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?\n모든 데이터가 삭제됩니다.")) return;
    try {
      await api.delete(`/courses/${id}`);
      toast.success("정상적으로 삭제되었습니다.");
      setShowDetailModal(false); // 모달 닫기
      fetchData();
    } catch (error) {
      toast.error(getErrorMessage(error, "삭제를 실패했습니다."));
    }
  };

  const handleUpdateCourse = async () => {
    if (!selectedCourse) return;
    try {
      await api.put(`/courses/${selectedCourse.id}`, {
        name: selectedCourse.name,
        end_date: selectedCourse.end_date,
        detail: selectedCourse.detail,
        department_id: selectedCourse.department_id,
      });
      toast.success("정보가 수정되었습니다.");
      fetchData();
      setShowDetailModal(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "수정하는 중 오류가 발생했습니다."));
    }
  };

  // --- 렌더링 ---
  const getMyEnrollment = (courseId: number) =>
    myEnrollments.find((e) => e.course_id === courseId);

  const filteredCourses = courses.filter((c) => {
    // 1. 교육담당 소유 교육만 보기 필터
    if (
      showOwnCoursesOnly &&
      user?.role === roles["교육담당"] &&
      !isOwnCourse(c)
    )
      return false;

    // 2. 미완료 필터가 꺼져있으면 통과
    if (!showUnfinishedOnly) return true;

    // 3. 관리자 + 소유 교육: 제출현황이 100%가 아닌 것만 보여줌
    if (isManager && isOwnCourse(c)) {
      const total = c.total_count || 0;
      const submitted = c.submitted_count || 0;
      return total > 0 && submitted < total;
    }

    // 4. 일반 사용자 또는 교육담당의 비소유 교육: 본인이 제출 안 한 것만 보여줌
    return !getMyEnrollment(c.id);
  });

  const calendarEventsByDate = groupEventsByDate(
    filteredCourses,
    getMyEnrollment,
  );

  const handleCalendarMonthChange = (newYear: number, newMonth: number) => {
    setCalendarMonth(newMonth);
    if (newYear !== year) setYear(newYear);
  };

  const handleDateClick = (_dateKey: string, events: CalendarEvent[]) => {
    if (events.length === 0) return;

    const ids = events.map((e) => e.courseId);
    setActiveTab("cards");
    setScrollTargetCourseId(ids[0]);
    setHighlightedCourseIds(new Set(ids));
    setTimeout(() => setHighlightedCourseIds(new Set()), 4000);
  };

  const handleSimpleListItemClick = (courseId: number) => {
    setActiveTab("cards");
    setScrollTargetCourseId(courseId);
    setHighlightedCourseIds(new Set([courseId]));
    setTimeout(() => setHighlightedCourseIds(new Set()), 4000);
  };

  return (
    <div className="h-full flex flex-col gap-6">
      {/* 상단 컨트롤 바 */}
      <div className="shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-md p-1 shrink-0">
            <button
              onClick={() => setActiveTab("calendar")}
              className={`px-3 py-1.5 rounded text-base font-medium transition whitespace-nowrap ${
                activeTab === "calendar"
                  ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-300 shadow"
                  : "text-gray-600 dark:text-gray-300"
              }`}
            >
              📅 캘린더
            </button>
            <button
              onClick={() => setActiveTab("cards")}
              className={`px-3 py-1.5 rounded text-base font-medium transition whitespace-nowrap ${
                activeTab === "cards"
                  ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-300 shadow"
                  : "text-gray-600 dark:text-gray-300"
              }`}
            >
              📋 교육목록
            </button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">
              조회 연도 :
            </span>
            <Select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              options={yearOptions}
              className="w-28"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
            <input
              type="checkbox"
              checked={showUnfinishedOnly}
              onChange={(e) => setShowUnfinishedOnly(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
            />
            <span className="text-base text-gray-600 dark:text-gray-300 whitespace-nowrap">
              {isManager ? "미완료 교육만 보기" : "미제출 건만 보기"}
            </span>
          </label>
          {user?.role === roles["교육담당"] && (
            <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
              <input
                type="checkbox"
                checked={showOwnCoursesOnly}
                onChange={(e) => setShowOwnCoursesOnly(e.target.checked)}
                className="w-4 h-4 text-sky-500 rounded focus:ring-sky-400"
              />
              <span className="text-base text-gray-600 dark:text-gray-300 whitespace-nowrap">
                내가 등록한 교육만 보기
              </span>
            </label>
          )}
        </div>

        {isSuperAdmin && (
          <button
            onClick={() => {
              setNewCourse({
                name: "",
                end_date: "",
                detail: "",
                department_id:
                  user?.role === roles["교육담당"]
                    ? (user?.departmentId ?? 0)
                    : 0,
              });
              setShowCreateModal(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-base font-medium transition"
          >
            + 교육과정 등록
          </button>
        )}
      </div>

      {activeTab === "calendar" ? (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
          <CalendarView
            year={year}
            month={calendarMonth}
            onMonthChange={handleCalendarMonthChange}
            eventsByDate={calendarEventsByDate}
            onDateClick={handleDateClick}
          />
          <SimpleCourseList
            courses={filteredCourses}
            getEnrollment={getMyEnrollment}
            onCourseClick={handleSimpleListItemClick}
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide grid gap-6 grid-cols-1 min-[870px]:grid-cols-2 content-start px-5 pt-3 pb-2">
          {isLoading ? (
            <div className="col-span-full text-center py-10 text-gray-500">
              로딩 중...
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="col-span-full text-center py-10 text-gray-500 dark:text-gray-400">
              등록된 교육과정이 없습니다.
            </div>
          ) : (
            filteredCourses.map((course) => {
              const enrollment = getMyEnrollment(course.id);
              const isDone = !!enrollment;

              const total = course.total_count || 0;
              const submitted = course.submitted_count || 0;
              const isAllSubmitted = total > 0 && submitted >= total;

              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const endDate = new Date(course.end_date);
              endDate.setHours(0, 0, 0, 0);

              const timeDiff = endDate.getTime() - today.getTime();
              const diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));

              const isUrgent = !isDone && diffDays >= 0 && diffDays <= 7;
              const isExpired = diffDays < 0;

              const isOwnActiveCourse =
                user?.role === roles["교육담당"] && isOwnCourse(course);

              return (
                <div
                  key={course.id}
                  ref={(el) => {
                    courseRefs.current[course.id] = el;
                  }}
                  className={`relative min-w-[360px] bg-white dark:bg-gray-800 rounded-lg shadow border-l-4 p-5
                  transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-xl hover:z-10
                  dark:hover:shadow-cyan-500/50
                  ${
                    isDone
                      ? "border-green-500"
                      : isExpired
                        ? "border-red-400"
                        : isUrgent
                          ? "border-red-500 shadow-red-100 dark:shadow-none ring-1 ring-red-100 dark:ring-red-900"
                          : isOwnActiveCourse
                            ? "border-sky-400"
                            : "border-orange-500"
                  }
                  cursor-pointer`}
                  onClick={() => openDetailModal(course)}
                >
                  {highlightedCourseIds.has(course.id) && (
                    <svg
                      className="pointer-events-none absolute inset-0 w-full h-full"
                      aria-hidden="true"
                    >
                      <defs>
                        <linearGradient id={`rainbow-gradient-${course.id}`}>
                          <stop offset="0%" stopColor="#ef4444" />
                          <stop offset="20%" stopColor="#f97316" />
                          <stop offset="40%" stopColor="#eab308" />
                          <stop offset="60%" stopColor="#22c55e" />
                          <stop offset="80%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#8b5cf6" />
                        </linearGradient>
                      </defs>
                      <rect
                        x="1"
                        y="1"
                        width="calc(100% - 2px)"
                        height="calc(100% - 2px)"
                        rx="8"
                        fill="none"
                        stroke={`url(#rainbow-gradient-${course.id})`}
                        strokeWidth="3"
                        strokeLinecap="round"
                        pathLength={100}
                        className="rainbow-dash"
                      />
                    </svg>
                  )}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3
                        className={`text-2xl font-bold flex items-center gap-2 mb-1 ${isExpired && !isDone ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-white"}`}
                      >
                        {course.name}
                        {/* 관리자에게만 보이는 상세보기 힌트 아이콘 */}
                        {isManager && (
                          <span className="text-base font-normal text-gray-400">
                            🔍
                          </span>
                        )}

                        {isUrgent && (
                          <span className="animate-pulse inline-flex items-center px-2 py-0.5 rounded text-base font-bold bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200">
                            🔥 마감임박 (D-{diffDays === 0 ? "Day" : diffDays})
                          </span>
                        )}

                        {isExpired && !isDone && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-base font-bold bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                            ⛔ 마감됨
                          </span>
                        )}
                      </h3>

                      <p
                        className={`text-base ${isUrgent ? "text-red-600 dark:text-red-400 font-semibold" : "text-gray-500 dark:text-gray-400"}`}
                      >
                        마감일: {formatDateWithDay(course.end_date)}
                      </p>

                      {isManager && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-base font-semibold text-indigo-600 dark:text-indigo-400">
                            📊{" "}
                            {isSuperAdmin
                              ? ""
                              : isDeptManager
                                ? user.department
                                : user.team}{" "}
                            {isOwnCourse(course)
                              ? `제출현황: ${submitted} / ${total} 명`
                              : "타 부서 교육"}
                          </span>

                          {isAllSubmitted && (
                            <span className="px-2 py-0.5 text-base font-bold rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700 animate-pulse">
                              🎉 완료
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <Badge isDone={isDone} isUrgent={isUrgent} className="ml-2" />
                  </div>

                  {/* 하단 액션 버튼 (클릭 이벤트 전파 방지 필수) */}
                  <div
                    className="flex justify-between items-end border-t border-gray-100 dark:border-gray-700 pt-4 mt-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex-1">
                      {isDone ? (
                        <div className="flex gap-2">
                          <FormButton
                            onClick={() =>
                              handleMyDownload(
                                enrollment.id,
                                enrollment.file_name!,
                              )
                            }
                          >
                            📄 수료증 다운
                          </FormButton>

                          <FormButton>
                            <label className="cursor-pointer">
                              수정
                              <input
                                type="file"
                                accept=".pdf,.jpg,.png"
                                className="hidden"
                                onChange={(e) =>
                                  e.target.files?.[0] &&
                                  handleFileUpload(course.id, e.target.files[0])
                                }
                              />
                            </label>
                          </FormButton>

                          <FormButton
                            onClick={() => deleteMyDownload(enrollment.id)}
                          >
                            ❌ 수료내역 삭제
                          </FormButton>
                        </div>
                      ) : (
                        <div>
                          <label
                            className="block w-full cursor-pointer bg-indigo-50 dark:bg-indigo-900/30
                                    hover:bg-indigo-100 dark:hover:bg-indigo-800
                                    text-indigo-700 dark:text-indigo-300
                                      border border-indigo-200 dark:border-indigo-800
                                      text-center px-4 py-2 rounded-md text-base font-medium transition"
                          >
                            📂 수료증 업로드 (최대 1MB)
                            <input
                              type="file"
                              accept=".pdf,.jpg,.png"
                              className="hidden"
                              onChange={(e) =>
                                e.target.files?.[0] &&
                                handleFileUpload(course.id, e.target.files[0])
                              }
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 교육과정 등록 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              새 교육과정 등록
            </h2>
            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <FormLabel>교육명</FormLabel>
                <TextInput
                  value={newCourse.name}
                  onChange={(e) =>
                    setNewCourse({ ...newCourse, name: e.target.value })
                  }
                />
              </div>
              <div>
                <FormLabel>마감일자</FormLabel>
                <TextInput
                  type="date"
                  value={newCourse.end_date}
                  onChange={(e) =>
                    setNewCourse({ ...newCourse, end_date: e.target.value })
                  }
                />
              </div>
              <div>
                <FormLabel>주관부서</FormLabel>
                {user?.role === roles["교육담당"] ? (
                  <Select
                    value={newCourse.department_id}
                    disabled
                    onChange={() => {}}
                    options={[
                      {
                        value: user?.departmentId ?? 0,
                        label: user?.department || "미지정",
                      },
                    ]}
                  />
                ) : (
                  <Select
                    value={newCourse.department_id}
                    onChange={(e) =>
                      setNewCourse({
                        ...newCourse,
                        department_id: Number(e.target.value),
                      })
                    }
                    options={courseDepartmentOptions}
                  />
                )}
              </div>
              <div>
                <FormLabel>상세정보 (선택)</FormLabel>
                <textarea
                  rows={4}
                  value={newCourse.detail}
                  onChange={(e) =>
                    setNewCourse({ ...newCourse, detail: e.target.value })
                  }
                  className="w-full border rounded px-3 py-2 resize-none dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  placeholder="내용을 입력하지 않아도 등록 가능합니다."
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <FormButton
                  onClick={() => setShowCreateModal(false)}
                  className="dark:hover:bg-gray-600"
                >
                  취소
                </FormButton>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  등록하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 상세정보 및 이수현황 모달 */}
      {showDetailModal && selectedCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-6xl max-h-[90vh] shadow-xl flex flex-col">
            {/* 모달 헤더 */}
            <div className="pt-6 pb-3 px-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 flex items-center">
                  {selectedCourse.name}
                  {isGeneralManager ? (
                    <Select
                      value={selectedCourse.department_id ?? 0}
                      onChange={(e) =>
                        setSelectedCourse({
                          ...selectedCourse,
                          department_id: Number(e.target.value),
                        })
                      }
                      options={courseDepartmentOptions}
                      className="ml-5 w-40 text-base font-normal"
                    />
                  ) : (
                    <span className="ml-5 text-base font-normal text-gray-500 dark:text-gray-400">
                      {selectedCourse.department}
                    </span>
                  )}
                </h2>
                <div className="flex">
                  <span className="flex items-center text-base font-semibold text-gray-500 dark:text-gray-400 mr-2">
                    마감일 :
                  </span>
                  {isSuperAdmin ? (
                    <input
                      type="date"
                      value={selectedCourse.end_date}
                      onChange={(e) =>
                        setSelectedCourse({
                          ...selectedCourse,
                          end_date: e.target.value,
                        })
                      }
                      className="border rounded px-2 py-1 text-base dark:bg-gray-700 dark:text-white border-gray-300 dark:border-gray-600"
                    />
                  ) : (
                    <p className="text-base text-gray-500 dark:text-gray-400">
                      {formatDateWithDay(selectedCourse.end_date)}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                &times;
              </button>
            </div>

            {/* 모달 본문 */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-6">
              {/* 상세정보 섹션 */}
              <div className="shrink-0 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 border-b border-gray-300 dark:border-gray-600 pb-1 mb-2">
                  📌 상세 정보
                </h3>

                {isSuperAdmin ? (
                  <textarea
                    rows={4}
                    value={selectedCourse.detail || ""}
                    onChange={(e) =>
                      setSelectedCourse({
                        ...selectedCourse,
                        detail: e.target.value,
                      })
                    }
                    className="w-full p-2 border rounded resize-none dark:bg-gray-700 dark:text-white border-gray-300 dark:border-gray-600"
                    placeholder="상세 정보를 입력하세요."
                  />
                ) : (
                  <p className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                    {selectedCourse.detail || "등록된 상세 정보가 없습니다."}
                  </p>
                )}
              </div>

              {/* 이수 현황 섹션 */}
              <div className="flex flex-col flex-1 min-h-0 mt-6">
                <div className="mb-4 gap-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {isManager
                      ? `👥 직원 이수 현황 (${
                          isSuperAdmin
                            ? "전체"
                            : isDeptManager
                              ? user?.department
                              : user?.team
                        })`
                      : "👥 이수 현황"}
                  </h3>
                </div>
                {isManager && selectedCourse && isOwnCourse(selectedCourse) && (
                  <div>
                    <div className="flex justify-end gap-2 mb-2">
                      <div className="flex gap-2">
                        {/* 부서 필터 */}
                        {isSuperAdmin && (
                          <Select
                            value={filterDepartment}
                            onChange={(e) =>
                              handleFilterDeptChange(Number(e.target.value))
                            }
                            options={departmentOptions}
                            className="w-40"
                          />
                        )}

                        {/* 팀 필터 */}
                        <Select
                          value={filterTeam}
                          onChange={(e) =>
                            setFilterTeam(Number(e.target.value))
                          }
                          options={filterTeamOptions}
                          className="w-40"
                        />

                        {/* 이수여부 필터 */}
                        <Select
                          value={filterState}
                          onChange={(e) => setFilterState(e.target.value)}
                          options={completeOptions}
                          className="w-32"
                        />

                        {/* AI검증 필터 */}
                        <Select
                          value={filterAiStatus}
                          onChange={(e) => setFilterAiStatus(e.target.value)}
                          options={aiFilterOptions}
                          className="w-36"
                        />
                      </div>
                      {isManager && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={handleCsvDownload}
                            className="text-base bg-green-50 text-green-700 px-3 py-1.5 rounded hover:bg-green-100"
                          >
                            📋 현황 CSV
                          </button>
                          <button
                            onClick={() =>
                              handleZipDownload(
                                selectedCourse.id,
                                selectedCourse.name,
                              )
                            }
                            className="text-base bg-blue-50 text-blue-600 px-3 py-1.5 rounded hover:bg-blue-100"
                          >
                            📦{" "}
                            {isSuperAdmin
                              ? "전체"
                              : isDeptManager
                                ? user.department
                                : user.team}{" "}
                            수료증 ZIP
                          </button>
                        </div>
                      )}
                      {selectedCourse && canManageCourse(selectedCourse) && (
                        <button
                          onClick={() => handleDeleteCourse(selectedCourse.id)}
                          className="text-base bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {/* 현황 테이블 */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg flex-1 overflow-y-auto scrollbar-hide min-h-0">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                      <tr>
                        <TableHeader>이름</TableHeader>
                        {isSuperAdmin && <TableHeader>부서</TableHeader>}
                        <TableHeader>팀(계)</TableHeader>
                        <TableHeader>상태</TableHeader>
                        <TableHeader>제출일 / 파일</TableHeader>
                        <TableHeader>AI 검증</TableHeader>
                        <TableHeader>관리</TableHeader>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredStatusList.length > 0 ? (
                        filteredStatusList.map((status) => (
                          <tr
                            key={status.user_id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          >
                            <td className="px-4 py-3 text-base text-center font-medium text-gray-900 dark:text-white">
                              {status.name}
                            </td>
                            {isSuperAdmin && (
                              <td className="px-4 py-3 text-base text-center text-gray-500 dark:text-gray-400">
                                {status.department}
                              </td>
                            )}
                            <td className="px-4 py-3 text-base text-center text-gray-500 dark:text-gray-400">
                              {status.team}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge isDone={status.state === 2} />
                            </td>
                            <td className="px-4 py-3 text-left text-base">
                              {status.state === 2 && status.enrollment_id ? (
                                status.file_name &&
                                status.file_name.length > 0 ? (
                                  <div className="flex flex-col text-left">
                                    {status.submitted_at}
                                    <button
                                      onClick={() =>
                                        handleUserFileDownload(
                                          status.enrollment_id!,
                                          status.file_name!,
                                        )
                                      }
                                      className={`text-left text-indigo-600 hover:text-indigo-900 hover:underline
                                                dark:text-indigo-400 dark:hover:text-indigo-500 cursor-pointer`}
                                    >
                                      📄 {status.file_name}
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex flex-col text-left">
                                    {status.submitted_at}
                                    <div className="text-gray-600 line-through">
                                      📄 파일명이 없거나 파일이 삭제되었습니다.
                                    </div>
                                  </div>
                                )
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-base">
                              {status.state === 2 && status.enrollment_id ? (
                                <div className="flex items-center justify-center gap-1">
                                  {status.ai_flagged === 1 && (
                                    <span
                                      title={
                                        status.ai_reasoning ??
                                        "AI 검증에서 의심스러운 부분이 발견되었습니다."
                                      }
                                    >
                                      ⚠️
                                    </span>
                                  )}
                                  {status.ai_verified === false && (
                                    <span title="AI 검증이 수행되지 않았습니다.">
                                      ❓
                                    </span>
                                  )}
                                  {status.ai_verified === true &&
                                    status.ai_flagged === 0 && (
                                      <span title="AI 검증 결과 이상이 발견되지 않았습니다.">
                                        🟢
                                      </span>
                                    )}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-base">
                              <div className="flex items-center justify-center gap-1.5">
                                {status.state === 2 && status.enrollment_id ? (
                                  <>
                                    {status.ai_verified === false &&
                                      (user?.role ?? 0) >=
                                        roles["부서담당"] && (
                                        <button
                                          onClick={() =>
                                            handleReverifyEnrollment(
                                              status.enrollment_id!,
                                              status.name,
                                            )
                                          }
                                          className="shrink-0 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 px-2 py-0.5 rounded transition"
                                        >
                                          🔄 재검증
                                        </button>
                                      )}
                                    {status.user_id !== user?.id && (
                                      <button
                                        onClick={() =>
                                          handleAdminDeleteEnrollment(
                                            status.enrollment_id!,
                                            status.name,
                                          )
                                        }
                                        className="shrink-0 text-base bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 px-3 py-1 rounded transition"
                                      >
                                        ❌ 삭제
                                      </button>
                                    )}
                                  </>
                                ) : status.user_id !== user?.id ? (
                                  <label className="inline-block cursor-pointer text-base text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 px-3 py-1 rounded transition">
                                    📎 대신 등록
                                    <input
                                      type="file"
                                      accept=".pdf,.jpg,.png"
                                      className="hidden"
                                      onChange={(e) =>
                                        e.target.files?.[0] &&
                                        handleProxyUpload(
                                          status.user_id,
                                          status.name,
                                          e.target.files[0],
                                        )
                                      }
                                    />
                                  </label>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={isSuperAdmin ? 7 : 6}
                            className="text-center py-4 text-gray-500"
                          >
                            조건에 맞는 데이터가 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 모달 하단 닫기 버튼 */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              {selectedCourse && canManageCourse(selectedCourse) && (
                <button
                  onClick={handleUpdateCourse}
                  className="px-3 py-1 text-base bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                >
                  수정사항 저장
                </button>
              )}
              <FormButton
                onClick={() => setShowDetailModal(false)}
                className="dark:hover:bg-gray-600"
              >
                닫기
              </FormButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainPage;
