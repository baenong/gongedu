import {
  buildMonthGrid,
  formatDateKey,
  itemVisibilityClass,
  overflowCounts,
  type CalendarEvent,
} from "../utils/calendarUtils";

interface CalendarViewProps {
  year: number;
  month: number; // 0-11
  onMonthChange: (year: number, month: number) => void;
  eventsByDate: Map<string, CalendarEvent[]>;
  onDateClick: (dateKey: string, events: CalendarEvent[]) => void;
}

const STATUS_COLOR: Record<CalendarEvent["status"], string> = {
  urgent: "bg-red-500",
  normal: "bg-orange-500",
  done: "bg-green-500",
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

// 인덱스 0 = 일요일, 6 = 토요일. 다크모드에서 채도 높은 원색은 눈에 잘 안 띄어
// 400번대의 파스텔에 가까운 톤을 사용한다.
const WEEKEND_TEXT_COLOR: Record<number, string> = {
  0: "text-red-500 dark:text-red-400",
  6: "text-blue-500 dark:text-blue-400",
};

const CalendarView = ({
  year,
  month,
  onMonthChange,
  eventsByDate,
  onDateClick,
}: CalendarViewProps) => {
  const days = buildMonthGrid(year, month);
  const todayKey = formatDateKey(new Date());

  const goPrevMonth = () => {
    const d = new Date(year, month - 1, 1);
    onMonthChange(d.getFullYear(), d.getMonth());
  };

  const goNextMonth = () => {
    const d = new Date(year, month + 1, 1);
    onMonthChange(d.getFullYear(), d.getMonth());
  };

  return (
    <div className="shrink-0 lg:shrink bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 lg:basis-[48rem] lg:min-w-[34rem]">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goPrevMonth}
          className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          aria-label="이전 달"
        >
          ◀
        </button>
        <span className="font-semibold text-gray-900 dark:text-white">
          {year}년 {month + 1}월
        </span>
        <button
          onClick={goNextMonth}
          className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          aria-label="다음 달"
        >
          ▶
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-sm mb-1">
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={label}
            className={
              WEEKEND_TEXT_COLOR[index] ?? "text-gray-500 dark:text-gray-400"
            }
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((date) => {
          const dateKey = formatDateKey(date);
          const events = eventsByDate.get(dateKey) ?? [];
          const isCurrentMonth = date.getMonth() === month;
          const { base, md, lg } = overflowCounts(events.length);
          const dayOfWeek = date.getDay();
          const isToday = dateKey === todayKey;

          return (
            <div
              key={dateKey}
              onClick={() =>
                events.length > 0 && onDateClick(dateKey, events)
              }
              className={`h-18 lg:h-24 rounded p-1 text-xs overflow-hidden ${
                isToday
                  ? "border-2 border-emerald-300 dark:border-emerald-500/60"
                  : "border border-gray-100 dark:border-gray-700"
              } ${
                isCurrentMonth
                  ? "bg-white dark:bg-gray-800"
                  : "bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-600"
              } ${events.length > 0 ? "cursor-pointer" : ""}`}
            >
              <div
                className={`font-semibold mb-1 ${isCurrentMonth ? WEEKEND_TEXT_COLOR[dayOfWeek] ?? "" : ""}`}
              >
                {date.getDate()}
              </div>

              {events.map((event, index) => (
                <div
                  key={event.courseId}
                  className={`${STATUS_COLOR[event.status]} text-white rounded px-1 mb-0.5 truncate ${itemVisibilityClass(index)}`}
                  title={event.name}
                >
                  {event.name}
                </div>
              ))}

              {base > 0 && (
                <div className="text-gray-500 dark:text-gray-400 block md:hidden">
                  +{base}개 더보기
                </div>
              )}
              {md > 0 && (
                <div className="text-gray-500 dark:text-gray-400 hidden md:block lg:hidden">
                  +{md}개 더보기
                </div>
              )}
              {lg > 0 && (
                <div className="text-gray-500 dark:text-gray-400 hidden lg:block">
                  +{lg}개 더보기
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarView;
