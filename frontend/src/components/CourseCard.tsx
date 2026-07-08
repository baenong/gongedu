import Badge from "./Badge";
import FormButton from "./FormButton";
import { formatDateWithDay } from "../utils/dateUtils";
import type { Course, Enrollment } from "../types";

interface CourseCardProps {
  course: Course;
  enrollment: Enrollment | undefined;
  isManager: boolean;
  isSuperAdmin: boolean;
  isOwnCourse: boolean;
  isOwnActiveCourse: boolean;
  managerLabel: string;
  isHighlighted: boolean;
  cardRef: (el: HTMLDivElement | null) => void;
  onClick: () => void;
  onUpload: (file: File) => void;
  onDownload: () => void;
  onDelete: () => void;
}

const CourseCard = ({
  course,
  enrollment,
  isManager,
  isSuperAdmin,
  isOwnCourse,
  isOwnActiveCourse,
  managerLabel,
  isHighlighted,
  cardRef,
  onClick,
  onUpload,
  onDownload,
  onDelete,
}: CourseCardProps) => {
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

  return (
    <div
      ref={cardRef}
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
      onClick={onClick}
    >
      {isHighlighted && (
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
            {isManager && (
              <span className="text-base font-normal text-gray-400">🔍</span>
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
                📊 {isSuperAdmin ? "" : managerLabel}{" "}
                {isOwnCourse
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

      <div
        className="flex justify-between items-end border-t border-gray-100 dark:border-gray-700 pt-4 mt-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1">
          {isDone ? (
            <div className="flex gap-2">
              <FormButton onClick={onDownload}>📄 수료증 다운</FormButton>

              <FormButton>
                <label className="cursor-pointer">
                  수정
                  <input
                    type="file"
                    accept=".pdf,.jpg,.png"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files?.[0] && onUpload(e.target.files[0])
                    }
                  />
                </label>
              </FormButton>

              <FormButton onClick={onDelete}>❌ 수료내역 삭제</FormButton>
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
                    e.target.files?.[0] && onUpload(e.target.files[0])
                  }
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseCard;
