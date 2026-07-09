import Badge from "./Badge";
import FormButton from "./FormButton";
import Select from "./Select";
import TableHeader from "./TableHeader";
import { formatDateWithDay } from "../utils/dateUtils";
import { CERTIFICATE_FILE_ACCEPT } from "../utils/constants";
import type { Course } from "../types";

export interface UserStatus {
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

interface Option {
  value: number | string;
  label: string;
}

// 직원 이수 현황 표를 좁히는 필터 4종(부서/팀/이수여부/AI검증)의 값·옵션·변경 핸들러를
// 하나로 묶어서 전달한다. 필터를 추가/제거할 때 이 타입 하나만 건드리면 된다.
export interface CourseStatusFilters {
  department: number;
  team: number;
  state: string;
  aiStatus: string;
  departmentOptions: Option[];
  teamOptions: Option[];
  stateOptions: Option[];
  aiStatusOptions: Option[];
  onDepartmentChange: (departmentId: number) => void;
  onTeamChange: (teamId: number) => void;
  onStateChange: (state: string) => void;
  onAiStatusChange: (status: string) => void;
}

interface CourseDetailModalProps {
  course: Course;
  onCourseChange: (course: Course) => void;
  onClose: () => void;
  isManager: boolean;
  isSuperAdmin: boolean;
  isGeneralManager: boolean;
  canViewStatus: boolean;
  canManageCourse: boolean;
  canReverify: boolean;
  currentUserId: number | undefined;
  orgLabel: string;
  filteredStatusList: UserStatus[];
  filters: CourseStatusFilters;
  courseDepartmentOptions: Option[];
  onCsvDownload: () => void;
  onZipDownload: () => void;
  onDeleteCourse: () => void;
  onUpdateCourse: () => void;
  onReverify: (enrollmentId: number, name: string) => void;
  onAdminDelete: (enrollmentId: number, name: string) => void;
  onProxyUpload: (userId: number, name: string, file: File) => void;
  onUserFileDownload: (enrollmentId: number, fileName: string) => void;
}

const CourseDetailModal = ({
  course,
  onCourseChange,
  onClose,
  isManager,
  isSuperAdmin,
  isGeneralManager,
  canViewStatus,
  canManageCourse,
  canReverify,
  currentUserId,
  orgLabel,
  filteredStatusList,
  filters,
  courseDepartmentOptions,
  onCsvDownload,
  onZipDownload,
  onDeleteCourse,
  onUpdateCourse,
  onReverify,
  onAdminDelete,
  onProxyUpload,
  onUserFileDownload,
}: CourseDetailModalProps) => {
  const {
    department: filterDepartment,
    team: filterTeam,
    state: filterState,
    aiStatus: filterAiStatus,
    departmentOptions,
    teamOptions: filterTeamOptions,
    stateOptions: completeOptions,
    aiStatusOptions: aiFilterOptions,
    onDepartmentChange: onFilterDepartmentChange,
    onTeamChange: onFilterTeamChange,
    onStateChange: onFilterStateChange,
    onAiStatusChange: onFilterAiStatusChange,
  } = filters;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-6xl max-h-[90vh] shadow-xl flex flex-col">
        <div className="pt-6 pb-3 px-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 flex items-center">
              {course.name}
              {isGeneralManager ? (
                <Select
                  value={course.department_id ?? 0}
                  onChange={(e) =>
                    onCourseChange({
                      ...course,
                      department_id: Number(e.target.value),
                    })
                  }
                  options={courseDepartmentOptions}
                  className="ml-5 w-40 text-base font-normal"
                />
              ) : (
                <span className="ml-5 text-base font-normal text-gray-500 dark:text-gray-400">
                  {course.department}
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
                  value={course.end_date}
                  onChange={(e) =>
                    onCourseChange({ ...course, end_date: e.target.value })
                  }
                  className="border rounded px-2 py-1 text-base dark:bg-gray-700 dark:text-white border-gray-300 dark:border-gray-600"
                />
              ) : (
                <p className="text-base text-gray-500 dark:text-gray-400">
                  {formatDateWithDay(course.end_date)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-6">
          <div className="shrink-0 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 border-b border-gray-300 dark:border-gray-600 pb-1 mb-2">
              📌 상세 정보
            </h3>

            {isSuperAdmin ? (
              <textarea
                rows={4}
                value={course.detail || ""}
                onChange={(e) =>
                  onCourseChange({ ...course, detail: e.target.value })
                }
                className="w-full p-2 border rounded resize-none dark:bg-gray-700 dark:text-white border-gray-300 dark:border-gray-600"
                placeholder="상세 정보를 입력하세요."
              />
            ) : (
              <p className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                {course.detail || "등록된 상세 정보가 없습니다."}
              </p>
            )}
          </div>

          <div className="flex flex-col flex-1 min-h-0 mt-6">
            <div className="mb-4 gap-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {isManager
                  ? `👥 직원 이수 현황 (${orgLabel})`
                  : "👥 이수 현황"}
              </h3>
            </div>
            {isManager && canViewStatus && (
              <div>
                <div className="flex justify-end gap-2 mb-2">
                  <div className="flex gap-2">
                    {isSuperAdmin && (
                      <Select
                        value={filterDepartment}
                        onChange={(e) =>
                          onFilterDepartmentChange(Number(e.target.value))
                        }
                        options={departmentOptions}
                        className="w-40"
                      />
                    )}

                    <Select
                      value={filterTeam}
                      onChange={(e) =>
                        onFilterTeamChange(Number(e.target.value))
                      }
                      options={filterTeamOptions}
                      className="w-40"
                    />

                    <Select
                      value={filterState}
                      onChange={(e) => onFilterStateChange(e.target.value)}
                      options={completeOptions}
                      className="w-32"
                    />

                    <Select
                      value={filterAiStatus}
                      onChange={(e) => onFilterAiStatusChange(e.target.value)}
                      options={aiFilterOptions}
                      className="w-36"
                    />
                  </div>
                  {isManager && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={onCsvDownload}
                        className="text-base bg-green-50 text-green-700 px-3 py-1.5 rounded hover:bg-green-100"
                      >
                        📋 현황 CSV
                      </button>
                      <button
                        onClick={onZipDownload}
                        className="text-base bg-blue-50 text-blue-600 px-3 py-1.5 rounded hover:bg-blue-100"
                      >
                        📦 {orgLabel} 수료증 ZIP
                      </button>
                    </div>
                  )}
                  {canManageCourse && (
                    <button
                      onClick={onDeleteCourse}
                      className="text-base bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
            )}
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
                            status.file_name && status.file_name.length > 0 ? (
                              <div className="flex flex-col text-left">
                                {status.submitted_at}
                                <button
                                  onClick={() =>
                                    onUserFileDownload(
                                      status.enrollment_id!,
                                      status.file_name!,
                                    )
                                  }
                                  className="text-left text-indigo-600 hover:text-indigo-900 hover:underline dark:text-indigo-400 dark:hover:text-indigo-500 cursor-pointer"
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
                                {status.ai_verified === false && canReverify && (
                                  <button
                                    onClick={() =>
                                      onReverify(
                                        status.enrollment_id!,
                                        status.name,
                                      )
                                    }
                                    className="shrink-0 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 px-2 py-0.5 rounded transition"
                                  >
                                    🔄 재검증
                                  </button>
                                )}
                                {status.user_id !== currentUserId && (
                                  <button
                                    onClick={() =>
                                      onAdminDelete(
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
                            ) : status.user_id !== currentUserId ? (
                              <label className="inline-block cursor-pointer text-base text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 px-3 py-1 rounded transition">
                                📎 대신 등록
                                <input
                                  type="file"
                                  accept={CERTIFICATE_FILE_ACCEPT}
                                  className="hidden"
                                  onChange={(e) =>
                                    e.target.files?.[0] &&
                                    onProxyUpload(
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

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          {canManageCourse && (
            <button
              onClick={onUpdateCourse}
              className="px-3 py-1 text-base bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
            >
              수정사항 저장
            </button>
          )}
          <FormButton onClick={onClose} className="dark:hover:bg-gray-600">
            닫기
          </FormButton>
        </div>
      </div>
    </div>
  );
};

export default CourseDetailModal;
