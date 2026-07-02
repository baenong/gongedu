import type { Course } from "../types";
import {
  classifyCourseStatus,
  type CourseStatus,
} from "../utils/calendarUtils";

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
                  <span className="truncate">
                    {course.name} ({course.end_date})
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default SimpleCourseList;
