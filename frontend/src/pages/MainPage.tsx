import React, { useEffect, useRef, useState } from "react";
import api from "../api/axios";
import axios from "axios";
import { useAuthStore } from "../store/authStore";
import { useRoleFlags } from "../hooks/useRoleFlags";
import { useCourseFilters } from "../hooks/useCourseFilters";
import type { Course, Enrollment, Department, Team } from "../types";
import Select from "../components/Select";
import toast from "react-hot-toast";
import CalendarView from "../components/CalendarView";
import SimpleCourseList from "../components/SimpleCourseList";
import CourseCard from "../components/CourseCard";
import CourseCreateModal from "../components/CourseCreateModal";
import CourseDetailModal, {
  type UserStatus,
} from "../components/CourseDetailModal";
import { groupEventsByDate, type CalendarEvent } from "../utils/calendarUtils";
import { getErrorMessage } from "../utils/errorUtils";
import { downloadBlob } from "../utils/downloadFile";
import { buildCsvBlob } from "../utils/csv";
import { roles } from "../utils/constants";

const MainPage = () => {
  const { user } = useAuthStore();
  const { isManager, isDeptManager, isSuperAdmin } = useRoleFlags(user);

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
    example_titles: "",
    department_id: 0,
  });

  // 상세정보 및 이수현황 모달 상태
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseStatusList, setCourseStatusList] = useState<UserStatus[]>([]);

  // 필터링
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);

  const {
    filters,
    courseDepartmentOptions,
    filteredStatusList,
    resetFilters,
    setFilterTeamOptions,
  } = useCourseFilters(departments, allTeams, courseStatusList);

  const yearOptions = [thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map(
    (y) => ({
      value: y,
      label: `${y}년`,
    }),
  );

  // 데이터 불러오기
  // signal이 주어지면(연도 변경에 따른 자동 재조회) 응답이 늦게 와도 최신 요청 결과만
  // 반영되도록 취소 가능하게 한다. 버튼 클릭 등 수동 재조회는 signal 없이 그대로 호출.
  const fetchData = async (signal?: AbortSignal) => {
    setIsLoading(true);
    try {
      const [courseRes, enrollRes, resDept, resTeam] = await Promise.all([
        api.get(`/courses?year=${year}`, { signal }),
        api.get("/enrollments/my", { signal }),
        isSuperAdmin ? api.get("/departments", { signal }) : null,
        isSuperAdmin ? api.get("/departments/teams", { signal }) : null,
      ]);
      setCourses(courseRes.data);
      setMyEnrollments(enrollRes.data);

      if (isSuperAdmin) {
        setDepartments(resDept!.data);
        setAllTeams(resTeam!.data);
      }
    } catch (error) {
      if (axios.isCancel(error)) return;
      console.error("데이터 로딩 실패:", error);
      toast.error(getErrorMessage(error, "데이터를 불러오지 못했습니다."));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        error: (error) => getErrorMessage(error, "업로드를 실패했습니다."),
      },
    );
  };

  const handleMyDownload = async (enrollmentId: number, fileName: string) => {
    try {
      const response = await api.get(`/enrollments/${enrollmentId}/download`, {
        responseType: "blob",
      });

      downloadBlob(new Blob([response.data]), fileName);
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
      error: (error) => getErrorMessage(error, "삭제 중 오류가 발생했습니다."),
    });
  };

  // --- 관리자 기능 ---

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/courses", { ...newCourse, year });
      toast.success("교육과정이 등록되었습니다.");
      setShowCreateModal(false);
      setNewCourse({
        name: "",
        end_date: "",
        detail: "",
        example_titles: "",
        department_id: 0,
      });
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

  // 상세 모달 열기 (직원 현황 조회)
  const openDetailModal = async (course: Course) => {
    setSelectedCourse(course);
    setShowDetailModal(true);

    // 모달 열 때마다 초기화
    resetFilters();
    setCourseStatusList([]);

    try {
      if (isManager && isOwnCourse(course)) {
        const res = await api.get(`/enrollments/course/${course.id}`);
        setCourseStatusList(res.data);

        // 부서담당: 응답 데이터에서 팀 목록 추출하여 팀 필터 옵션 구성
        if (isDeptManager) {
          const teamMap = new Map<number, string>();
          res.data.forEach((s: UserStatus) => {
            teamMap.set(s.teamId, s.team);
          });
          setFilterTeamOptions([
            { label: "모든 팀(계)", value: -1 },
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
      error: (error) => getErrorMessage(error, "등록을 실패했습니다."),
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
      error: (error) => getErrorMessage(error, "삭제 중 오류가 발생했습니다."),
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
      error: (error) => getErrorMessage(error, "재검증 중 오류가 발생했습니다."),
    });
  };

  // ZIP 다운로드
  const handleZipDownload = async (courseId: number, courseName: string) => {
    try {
      const params: Record<string, number> = {};
      if (isSuperAdmin) {
        if (filters.department !== -1) params.departmentId = filters.department;
        if (filters.team !== -1) params.teamId = filters.team;
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

      downloadBlob(new Blob([response.data]), filename);
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

    downloadBlob(
      buildCsvBlob(headers, rows),
      `${selectedCourse.name}_이수현황.csv`,
    );
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
        example_titles: selectedCourse.example_titles,
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
                example_titles: "",
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
              const ownCourse = isOwnCourse(course);
              const isOwnActiveCourse =
                user?.role === roles["교육담당"] && ownCourse;

              return (
                <CourseCard
                  key={course.id}
                  course={course}
                  enrollment={enrollment}
                  isOwnCourse={ownCourse}
                  isOwnActiveCourse={isOwnActiveCourse}
                  isHighlighted={highlightedCourseIds.has(course.id)}
                  cardRef={(el) => {
                    courseRefs.current[course.id] = el;
                  }}
                  onClick={() => openDetailModal(course)}
                  onUpload={(file) => handleFileUpload(course.id, file)}
                  onDownload={() =>
                    enrollment?.file_name &&
                    handleMyDownload(enrollment.id, enrollment.file_name)
                  }
                  onDelete={() => enrollment && deleteMyDownload(enrollment.id)}
                />
              );
            })
          )}
        </div>
      )}

      {showCreateModal && (
        <CourseCreateModal
          newCourse={newCourse}
          onChange={setNewCourse}
          onSubmit={handleCreateCourse}
          onClose={() => setShowCreateModal(false)}
          departmentOptions={courseDepartmentOptions}
        />
      )}

      {showDetailModal && selectedCourse && (
        <CourseDetailModal
          course={selectedCourse}
          onCourseChange={setSelectedCourse}
          onClose={() => setShowDetailModal(false)}
          canViewStatus={isOwnCourse(selectedCourse)}
          filteredStatusList={filteredStatusList}
          filters={filters}
          courseDepartmentOptions={courseDepartmentOptions}
          actions={{
            onCsvDownload: handleCsvDownload,
            onZipDownload: () =>
              handleZipDownload(selectedCourse.id, selectedCourse.name),
            onDeleteCourse: () => handleDeleteCourse(selectedCourse.id),
            onUpdateCourse: handleUpdateCourse,
            onReverify: handleReverifyEnrollment,
            onAdminDelete: handleAdminDeleteEnrollment,
            onProxyUpload: handleProxyUpload,
            onUserFileDownload: handleUserFileDownload,
          }}
        />
      )}
    </div>
  );
};

export default MainPage;
