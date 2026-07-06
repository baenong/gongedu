import type { Course } from "../types";
import {
  classifyCourseStatus,
  type CourseStatus,
} from "../utils/calendarUtils";
import { formatShortDate } from "../utils/dateUtils";

interface SimpleCourseListProps {
  courses: Course[];
  getEnrollment: (courseId: number) => { state: number } | undefined;
  onCourseClick: (courseId: number) => void;
}

const STATUS_DOT_COLOR: Record<CourseStatus, string> = {
  urgent: "bg-red-500",
  normal: "bg-orange-500",
  done: "bg-green-500",
};

const SimpleCourseList = ({
  courses,
  getEnrollment,
  onCourseClick,
}: SimpleCourseListProps) => {
  const sorted = [...courses].sort(
    (a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime(),
  );

  return (
    <div className="flex-1 min-h-0 lg:min-w-[240px] overflow-y-auto scrollbar-hide bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
      {sorted.length === 0 ? (
        <div className="text-center py-10 text-gray-500 dark:text-gray-400">
          등록된 교육과정이 없습니다.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 px-2 pb-1.5 mb-1 border-b border-gray-200 dark:border-gray-700 text-base font-semibold text-gray-500 dark:text-gray-400">
            <span className="w-2.5 shrink-0" />
            <span className="w-18 shrink-0">마 감 일</span>
            <span className="shrink-0 text-gray-300 dark:text-gray-600">|</span>
            <span className="flex-1">교 육 명</span>
            <span className="w-20 shrink-0 text-right">주관부서</span>
          </div>
          <ul className="space-y-1">
            {sorted.map((course) => {
              const isDone = !!getEnrollment(course.id);
              const status = classifyCourseStatus(course, isDone);

              return (
                <li key={course.id}>
                  <button
                    onClick={() => onCourseClick(course.id)}
                    className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100"
                  >
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT_COLOR[status]}`}
                    />
                    <span className="w-18 shrink-0 tabular-nums text-gray-500 dark:text-gray-400">
                      ({formatShortDate(course.end_date)})
                    </span>
                    <span className="shrink-0 text-gray-300 dark:text-gray-600">
                      |
                    </span>
                    <span className="truncate flex-1">{course.name}</span>
                    <span className="w-20 shrink-0 text-right truncate text-gray-500 dark:text-gray-400">
                      {course.department}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};

export default SimpleCourseList;
